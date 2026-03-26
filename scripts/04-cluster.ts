import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { agnes } from "ml-hclust";
import { similarity } from "ml-distance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbeddingRecord {
  id: string;
  vector: number[];
}

interface DendrogramNode {
  id?: string;
  children?: [DendrogramNode, DendrogramNode];
  height: number;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OUTPUT_DIR = join(__dirname, "output");
const EMBEDDINGS_PATH = join(OUTPUT_DIR, "embeddings.json");
const OUTPUT_PATH = join(OUTPUT_DIR, "clustering.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a pairwise cosine distance matrix from embedding vectors.
 * Cosine distance = 1 - cosine similarity.
 */
function buildCosineDistanceMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = 1 - similarity.cosine(vectors[i], vectors[j]);
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

/**
 * Recursively convert ml-hclust's Cluster tree into our DendrogramNode format.
 * Leaf nodes get the scholar ID via index lookup; internal nodes get two children.
 */
function clusterToDendrogram(
  cluster: ReturnType<typeof agnes>,
  ids: string[]
): DendrogramNode {
  if (cluster.isLeaf) {
    return {
      id: ids[cluster.index],
      height: 0,
    };
  }

  return {
    children: [
      clusterToDendrogram(cluster.children[0], ids),
      clusterToDendrogram(cluster.children[1], ids),
    ],
    height: cluster.height,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Load embeddings
  if (!existsSync(EMBEDDINGS_PATH)) {
    console.error(`Input file not found: ${EMBEDDINGS_PATH}`);
    console.error("Run pipeline:embed first to generate embeddings.json");
    process.exit(1);
  }

  const embeddings: EmbeddingRecord[] = JSON.parse(
    readFileSync(EMBEDDINGS_PATH, "utf-8")
  );
  console.log(`Loaded ${embeddings.length} embeddings from ${EMBEDDINGS_PATH}`);

  const ids = embeddings.map((e) => e.id);
  const vectors = embeddings.map((e) => e.vector);

  // Build pairwise cosine distance matrix
  console.log("Computing pairwise cosine distance matrix...");
  const distanceMatrix = buildCosineDistanceMatrix(vectors);
  console.log(`  Distance matrix: ${distanceMatrix.length}x${distanceMatrix.length}`);

  // Run agglomerative clustering with Ward's linkage
  console.log("Running agglomerative clustering (Ward's method)...");
  const tree = agnes(distanceMatrix, { method: "ward", isDistanceMatrix: true });
  console.log(`  Clustering complete. Tree height: ${tree.height.toFixed(4)}`);

  // Convert to DendrogramNode format
  console.log("Converting to dendrogram format...");
  const dendrogram = clusterToDendrogram(tree, ids);

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(dendrogram, null, 2), "utf-8");
  console.log(`\nDone. Wrote dendrogram to ${OUTPUT_PATH}`);
}

main();
