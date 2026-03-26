import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createGeminiClient } from "./lib/gemini";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scholar {
  id: string;
  text: string;
  [key: string]: unknown;
}

interface EmbeddingRecord {
  id: string;
  vector: number[];
}

interface Checkpoint {
  completed: string[]; // scholar IDs already embedded
  embeddings: EmbeddingRecord[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = "gemini-embedding-exp-03-07";
const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OUTPUT_DIR = join(import.meta.dirname, "output");
const INPUT_PATH = join(OUTPUT_DIR, "scholars.json");
const CHECKPOINT_PATH = join(OUTPUT_DIR, "embeddings-checkpoint.json");
const OUTPUT_PATH = join(OUTPUT_DIR, "embeddings.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCheckpoint(): Checkpoint {
  if (existsSync(CHECKPOINT_PATH)) {
    const raw = readFileSync(CHECKPOINT_PATH, "utf-8");
    return JSON.parse(raw) as Checkpoint;
  }
  return { completed: new Set<string>() as unknown as string[], embeddings: [] };
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Embedding with retry
// ---------------------------------------------------------------------------

async function embedBatchWithRetry(
  client: ReturnType<typeof createGeminiClient>,
  texts: string[]
): Promise<number[][]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
      });

      if (!response.embeddings || response.embeddings.length !== texts.length) {
        throw new Error(
          `Expected ${texts.length} embeddings, got ${response.embeddings?.length ?? 0}`
        );
      }

      return response.embeddings.map((e) => {
        if (!e.values || e.values.length === 0) {
          throw new Error("Received empty embedding values");
        }
        return e.values;
      });
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);

      if (isLast) {
        throw err;
      }

      console.warn(
        `  Attempt ${attempt}/${MAX_RETRIES} failed: ${err instanceof Error ? err.message : err}. Retrying in ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("Exhausted retries");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load scholars
  if (!existsSync(INPUT_PATH)) {
    console.error(`Input file not found: ${INPUT_PATH}`);
    console.error("Run pipeline:split first to generate scholars.json");
    process.exit(1);
  }

  const scholars: Scholar[] = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  console.log(`Loaded ${scholars.length} scholars from ${INPUT_PATH}`);

  // Load checkpoint for resumability
  const checkpoint = loadCheckpoint();
  const completedSet = new Set(checkpoint.completed);
  console.log(`Checkpoint: ${completedSet.size} scholars already embedded`);

  // Filter out already-completed scholars
  const remaining = scholars.filter((s) => !completedSet.has(s.id));
  if (remaining.length === 0) {
    console.log("All scholars already embedded. Writing final output...");
    writeFileSync(OUTPUT_PATH, JSON.stringify(checkpoint.embeddings, null, 2), "utf-8");
    console.log(`Done. Wrote ${checkpoint.embeddings.length} embeddings to ${OUTPUT_PATH}`);
    return;
  }

  console.log(`${remaining.length} scholars remaining to embed`);

  // Create Gemini client
  const client = createGeminiClient();

  // Process in batches
  const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, remaining.length);
    const batch = remaining.slice(start, end);

    console.log(
      `Embedding batch ${batchIdx + 1}/${totalBatches} (${batch.length} scholars)...`
    );

    const texts = batch.map((s) => s.text);
    const vectors = await embedBatchWithRetry(client, texts);

    // Append results
    for (let i = 0; i < batch.length; i++) {
      checkpoint.embeddings.push({
        id: batch[i].id,
        vector: vectors[i],
      });
      checkpoint.completed.push(batch[i].id);
    }

    // Save checkpoint after each batch
    saveCheckpoint(checkpoint);
    console.log(`  Saved checkpoint (${checkpoint.embeddings.length} total)`);

    // Rate-limit pause between batches
    if (batchIdx < totalBatches - 1) {
      await sleep(500);
    }
  }

  // Write final output
  writeFileSync(OUTPUT_PATH, JSON.stringify(checkpoint.embeddings, null, 2), "utf-8");
  console.log(
    `\nDone. Wrote ${checkpoint.embeddings.length} embeddings to ${OUTPUT_PATH}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
