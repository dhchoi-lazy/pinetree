import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScholarRaw {
  name: string;
  namePinyin: string;
  courtesy: string;
  title: string;
  xuean: string;
  xueanPinyin: string;
  section: string;
  text: string;
}

interface Scholar extends ScholarRaw {
  id: string;
  volume: number;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUTPUT_DIR = join(__dirname, "output");

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildChunkPrompt(
  xueanName: string,
  sectionHeader: string,
  chunkText: string
): string {
  return `You are a classical Chinese text parser specializing in 宋元學案.

Extract each individual scholar entry from this section. Scholar entries typically begin with a header line in the format: [官職/諡號][姓][字/號]先生[名] (e.g., "文昭胡安定先生瑗", "節孝徐仲車先生積").

The 學案 name is: ${xueanName}
The section (◆) is: ${sectionHeader}

For each scholar, return a JSON object with these fields:
- "name": Chinese name only (e.g., "胡瑗")
- "namePinyin": Pinyin with tone marks removed, capitalized (e.g., "Hu Yuan")
- "courtesy": Courtesy name / 字 (e.g., "翼之"), or "" if not found
- "title": Posthumous/official title (e.g., "文昭"), or "" if not found
- "xuean": "${xueanName}"
- "xueanPinyin": Pinyin of the xuean name without "學案" suffix (e.g., "Anding")
- "section": "${sectionHeader}"
- "text": The full text of this scholar's entry, with proper modern Chinese punctuation

If this section has no individual scholar biography entries (e.g., only cross-references like 別為/別見, or only a preface/序錄), return an empty array [].

Return ONLY a JSON array. No markdown fences, no explanation.

---

${chunkText}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function volumeNumber(filename: string): number {
  const match = filename.match(/^(\d{3})_/);
  return match ? parseInt(match[1], 10) : -1;
}

function pinyinSlug(pinyin: string): string {
  return pinyin
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

/** Extract xuean name from volume header, e.g., "安定學案" from "第001卷 卷一　安定學案黃氏原本、全氏修定" */
function extractXueanName(text: string): string {
  // Look for the 學案 line (usually line 3), e.g., "安定學案　黃宗羲原本　　黃百家纂輯"
  const lines = text.split("\n").slice(0, 10);
  for (const line of lines) {
    const match = line.match(/^([^\s　]+學案)/);
    if (match) return match[1];
  }
  // Fallback: extract from header line
  const headerMatch = lines[0]?.match(/[　\s]([^\s　]+學案)/);
  if (headerMatch) return headerMatch[1];
  return "";
}

/** Split a volume text into chunks at ◆ markers */
function splitIntoChunks(
  text: string
): { header: string; section: string; body: string }[] {
  const lines = text.split("\n");
  const chunks: { header: string; section: string; body: string }[] = [];

  // Find the first ◆ marker — everything before it is the header/preface
  let firstMarker = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("◆")) {
      firstMarker = i;
      break;
    }
  }

  if (firstMarker === -1) {
    // No ◆ markers — treat entire text as one chunk
    chunks.push({
      header: lines[0] ?? "",
      section: "",
      body: text,
    });
    return chunks;
  }

  // Split at each ◆ marker
  let currentSection = "";
  let currentLines: string[] = [];

  for (let i = firstMarker; i < lines.length; i++) {
    if (lines[i].startsWith("◆")) {
      // Save previous chunk if it has content
      if (currentSection && currentLines.length > 0) {
        chunks.push({
          header: lines[0] ?? "",
          section: currentSection,
          body: currentLines.join("\n"),
        });
      }
      currentSection = lines[i].replace("◆", "").trim();
      currentLines = [];
    } else {
      currentLines.push(lines[i]);
    }
  }

  // Save last chunk
  if (currentSection && currentLines.length > 0) {
    chunks.push({
      header: lines[0] ?? "",
      section: currentSection,
      body: currentLines.join("\n"),
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// API call with retry
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const LITELLM_URL = "https://llm.dhchoi.net/v1";
const LITELLM_KEY = process.env.LITELLM_MASTER_KEY || "sk-c36501d98c9a430e1598223c3d2e6b415afa6df6331ed80dce60b42728c61ae4";
const MODEL = "gpt-5.4";

async function callLLM(
  client: OpenAI,
  prompt: string,
  label: string
): Promise<ScholarRaw[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const backoff = attempt * 3000;
        console.log(`    ↻ Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms...`);
        await sleep(backoff);
      }

      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 65536,
      });

      const raw = response.choices[0]?.message?.content ?? "";
      const cleaned = stripCodeFences(raw);

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const bracketStart = cleaned.indexOf("[");
        const bracketEnd = cleaned.lastIndexOf("]");
        if (bracketStart !== -1 && bracketEnd > bracketStart) {
          try {
            parsed = JSON.parse(cleaned.substring(bracketStart, bracketEnd + 1));
          } catch {
            console.error(`    ✗ ${label}: JSON parse failed. First 200 chars: ${cleaned.substring(0, 200)}`);
            throw new Error("JSON parse error");
          }
        } else {
          console.error(`    ✗ ${label}: No JSON array found. First 200 chars: ${cleaned.substring(0, 200)}`);
          throw new Error("JSON parse error");
        }
      }

      if (!Array.isArray(parsed)) {
        console.error(`    ✗ ${label}: Response is not an array`);
        return [];
      }
      return parsed;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`    ✗ ${label}: Attempt ${attempt} failed: ${msg.substring(0, 120)}`);
      if (attempt === MAX_RETRIES) {
        console.error(`    ✗ ${label}: All retries exhausted`);
        return [];
      }
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  const volumeFiles = allFiles.filter((f) => !f.startsWith("000_"));

  console.log(
    `Found ${allFiles.length} total files, processing ${volumeFiles.length} volumes (skipping 000)`
  );

  const client = new OpenAI({ baseURL: LITELLM_URL, apiKey: LITELLM_KEY });

  for (let i = 0; i < volumeFiles.length; i++) {
    const filename = volumeFiles[i];
    const volNum = volumeNumber(filename);
    const volLabel = String(volNum).padStart(3, "0");
    const intermediateFile = join(OUTPUT_DIR, `scholars-v${volLabel}.json`);

    if (existsSync(intermediateFile)) {
      console.log(
        `[${i + 1}/${volumeFiles.length}] Volume ${volLabel} — cached, skipping`
      );
      continue;
    }

    console.log(
      `[${i + 1}/${volumeFiles.length}] Processing volume ${volLabel} (${filename})...`
    );

    const text = readFileSync(join(DATA_DIR, filename), "utf-8");
    const xueanName = extractXueanName(text);
    const chunks = splitIntoChunks(text);

    console.log(`  Split into ${chunks.length} section(s), xuean: ${xueanName}`);

    const volumeScholars: ScholarRaw[] = [];

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const sectionLabel = chunk.section || "(main)";
      const chunkSize = chunk.body.length;

      // Skip very small chunks (likely just cross-references)
      if (chunkSize < 50) {
        console.log(`  [${c + 1}/${chunks.length}] ${sectionLabel} — too small (${chunkSize} chars), skipping`);
        continue;
      }

      console.log(`  [${c + 1}/${chunks.length}] ${sectionLabel} (${chunkSize} chars)...`);

      // If chunk is very large, process as-is but with a note
      // The 16384 maxOutputTokens and 120s timeout should handle up to ~20KB
      const prompt = buildChunkPrompt(xueanName, sectionLabel, chunk.body);
      const scholars = await callLLM(client, prompt,`v${volLabel}/${sectionLabel}`);

      if (scholars.length > 0) {
        console.log(`    → ${scholars.length} scholar(s)`);
        volumeScholars.push(...scholars);
      }

      // Small delay between chunks
      if (c < chunks.length - 1) {
        await sleep(500);
      }
    }

    if (volumeScholars.length > 0) {
      console.log(`  Total: ${volumeScholars.length} scholar(s) for volume ${volLabel}`);
      writeFileSync(intermediateFile, JSON.stringify(volumeScholars, null, 2), "utf-8");
    } else {
      console.log(`  ⚠ No scholars extracted for volume ${volLabel}`);
    }

    // Rate limit between volumes
    if (i < volumeFiles.length - 1) {
      await sleep(1000);
    }
  }

  // -------------------------------------------------------------------------
  // Merge
  // -------------------------------------------------------------------------

  console.log("\nMerging intermediate files...");

  const allScholars: Scholar[] = [];

  for (const filename of volumeFiles) {
    const volNum = volumeNumber(filename);
    const volLabel = String(volNum).padStart(3, "0");
    const intermediateFile = join(OUTPUT_DIR, `scholars-v${volLabel}.json`);

    if (!existsSync(intermediateFile)) {
      console.warn(`  Missing intermediate file for volume ${volLabel}`);
      continue;
    }

    const raw: ScholarRaw[] = JSON.parse(
      readFileSync(intermediateFile, "utf-8")
    );

    for (const scholar of raw) {
      const slug = pinyinSlug(scholar.namePinyin || scholar.name);
      const id = `v${volLabel}-${slug}`;

      allScholars.push({
        ...scholar,
        id,
        volume: volNum,
      });
    }
  }

  const outputPath = join(OUTPUT_DIR, "scholars.json");
  writeFileSync(outputPath, JSON.stringify(allScholars, null, 2), "utf-8");

  console.log(
    `\nDone. Wrote ${allScholars.length} scholars to ${outputPath}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
