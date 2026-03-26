import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { createGeminiClient } from "./lib/gemini";

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

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUTPUT_DIR = join(__dirname, "output");

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(volumeText: string): string {
  return `You are a classical Chinese text parser specializing in 宋元學案.

Given a volume of text, extract each individual scholar entry. Scholar entries typically begin with a header line in the format: [官職/諡號][姓][字/號]先生[名] (e.g., "文昭胡安定先生瑗", "節孝徐仲車先生積").

Sections beginning with ◆ (e.g., "◆安定門人") indicate relationship groupings — use these as the "section" field.

The 學案 name is stated in the volume header (first line), e.g., "安定學案" from "第001卷 卷一 安定學案".

For each scholar, return a JSON object with these fields:
- "name": Chinese name only (e.g., "胡瑗")
- "namePinyin": Pinyin with tone marks removed, capitalized (e.g., "Hu Yuan")
- "courtesy": Courtesy name / 字 (e.g., "翼之"), or "" if not found
- "title": Posthumous/official title (e.g., "文昭"), or "" if not found
- "xuean": The 學案 name from the volume header (e.g., "安定學案")
- "xueanPinyin": Pinyin of the xuean name without "學案" suffix (e.g., "Anding")
- "section": The ◆ section header this scholar appears under (e.g., "安定門人")
- "text": The full text of this scholar's entry, with proper modern Chinese punctuation

Return ONLY a JSON array. No markdown fences, no explanation.

---

${volumeText}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract the 3-digit volume number from a filename like "001_第001卷_卷一.txt". */
function volumeNumber(filename: string): number {
  const match = filename.match(/^(\d{3})_/);
  return match ? parseInt(match[1], 10) : -1;
}

/** Turn "Hu Yuan" into "hu-yuan" for use in IDs. */
function pinyinSlug(pinyin: string): string {
  return pinyin
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Strip markdown code fences if present (safety net). */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Discover volume files, excluding volume 000 (卷首 — front matter)
  const allFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  const volumeFiles = allFiles.filter((f) => !f.startsWith("000_"));

  console.log(
    `Found ${allFiles.length} total files, processing ${volumeFiles.length} volumes (skipping 000)`
  );

  const client = createGeminiClient();

  // Process each volume sequentially
  for (let i = 0; i < volumeFiles.length; i++) {
    const filename = volumeFiles[i];
    const volNum = volumeNumber(filename);
    const volLabel = String(volNum).padStart(3, "0");
    const intermediateFile = join(OUTPUT_DIR, `scholars-v${volLabel}.json`);

    // Skip if intermediate result already exists (allows resuming)
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
    const prompt = buildPrompt(text);

    let scholars: ScholarRaw[] | null = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          const backoff = attempt * 3000;
          console.log(`  ↻ Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms...`);
          await sleep(backoff);
        }

        const response = await client.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            httpOptions: { timeout: 300_000 },
          },
        });

        const raw = response.text ?? "";
        const cleaned = stripCodeFences(raw);

        try {
          scholars = JSON.parse(cleaned);
        } catch {
          console.error(
            `  ✗ Failed to parse JSON for volume ${volLabel}. Saving raw response.`
          );
          writeFileSync(
            join(OUTPUT_DIR, `scholars-v${volLabel}.raw.txt`),
            raw,
            "utf-8"
          );
          scholars = [];
        }

        if (!Array.isArray(scholars)) {
          console.error(
            `  ✗ Response is not an array for volume ${volLabel}. Got: ${typeof scholars}`
          );
          scholars = [];
        }

        break; // success — exit retry loop
      } catch (err: any) {
        console.error(`  ✗ Attempt ${attempt} failed for volume ${volLabel}: ${err?.message ?? err}`);
        if (attempt === MAX_RETRIES) {
          console.error(`  ✗ All ${MAX_RETRIES} attempts failed for volume ${volLabel}. Skipping (will retry on next run).`);
          // Do NOT write file — leave it missing so next run retries
        }
      }
    }

    if (scholars !== null && scholars.length > 0) {
      console.log(`  → Extracted ${scholars.length} scholar(s)`);
      writeFileSync(intermediateFile, JSON.stringify(scholars, null, 2), "utf-8");
    } else if (scholars !== null) {
      console.log(`  → 0 scholars extracted (empty result)`);
      // Don't cache empty results — leave for retry
    }

    // Respect rate limits
    if (i < volumeFiles.length - 1) {
      await sleep(1000);
    }
  }

  // -------------------------------------------------------------------------
  // Merge all intermediate files into scholars.json
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
