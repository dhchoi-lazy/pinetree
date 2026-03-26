import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { UMAP } from "umap-js";
import { normalize3D } from "./lib/normalize";

// tsne-js has no type declarations — use require for CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TSNE = require("tsne-js");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbeddingRecord {
  id: string;
  vector: number[];
}

interface PositionRecord {
  id: string;
  umap: [number, number, number];
  tsne: [number, number, number];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OUTPUT_DIR = join(import.meta.dirname, "output");
const INPUT_PATH = join(OUTPUT_DIR, "embeddings.json");
const OUTPUT_PATH = join(OUTPUT_DIR, "positions.json");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Load embeddings
  if (!existsSync(INPUT_PATH)) {
    console.error(`Input file not found: ${INPUT_PATH}`);
    console.error("Run pipeline:embed first to generate embeddings.json");
    process.exit(1);
  }

  const embeddings: EmbeddingRecord[] = JSON.parse(
    readFileSync(INPUT_PATH, "utf-8")
  );
  console.log(`Loaded ${embeddings.length} embeddings from ${INPUT_PATH}`);

  const vectors = embeddings.map((e) => e.vector);
  const dims = vectors[0]?.length ?? 0;
  console.log(`Vector dimensionality: ${dims}`);

  // -----------------------------------------------------------------------
  // UMAP (nNeighbors=15, minDist=0.1, 3D)
  // -----------------------------------------------------------------------
  console.log("\nRunning UMAP (nNeighbors=15, minDist=0.1, nComponents=3)...");
  const umap = new UMAP({ nNeighbors: 15, minDist: 0.1, nComponents: 3 });
  const umapRaw = umap.fit(vectors) as number[][];
  console.log(`  UMAP done — ${umapRaw.length} positions`);

  // -----------------------------------------------------------------------
  // t-SNE (perplexity=30, dim=3)
  // -----------------------------------------------------------------------
  console.log("\nRunning t-SNE (perplexity=30, dim=3)...");
  const tsneModel = new TSNE({
    dim: 3,
    perplexity: 30,
  });
  tsneModel.init({ data: vectors, type: "dense" });
  tsneModel.run();
  const tsneRaw = tsneModel.getOutputScaled() as number[][];
  console.log(`  t-SNE done — ${tsneRaw.length} positions`);

  // -----------------------------------------------------------------------
  // Normalize both to [-20, 20]
  // -----------------------------------------------------------------------
  console.log("\nNormalizing positions to [-20, 20]...");
  const umapNorm = normalize3D(
    umapRaw.map((p) => [p[0], p[1], p[2]] as [number, number, number])
  );
  const tsneNorm = normalize3D(
    tsneRaw.map((p) => [p[0], p[1], p[2]] as [number, number, number])
  );

  // -----------------------------------------------------------------------
  // Build output
  // -----------------------------------------------------------------------
  const positions: PositionRecord[] = embeddings.map((e, i) => ({
    id: e.id,
    umap: umapNorm[i],
    tsne: tsneNorm[i],
  }));

  writeFileSync(OUTPUT_PATH, JSON.stringify(positions, null, 2), "utf-8");
  console.log(`\nDone. Wrote ${positions.length} positions to ${OUTPUT_PATH}`);
}

main();
