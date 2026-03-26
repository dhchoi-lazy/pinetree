import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawScholar {
  id: string;
  name: string;
  namePinyin: string;
  courtesy: string;
  title: string;
  xuean: string;
  xueanPinyin: string;
  volume: number;
  section: string;
  text: string;
}

interface PositionRecord {
  id: string;
  umap: [number, number, number];
  tsne: [number, number, number];
}

interface DendrogramNode {
  id?: string;
  children?: [DendrogramNode, DendrogramNode];
  height: number;
}

interface Scholar {
  id: string;
  name: string;
  namePinyin: string;
  courtesy: string;
  title: string;
  xueanId: string;
  volume: number;
  section: string;
  text: string;
  umap: [number, number, number];
  tsne: [number, number, number];
}

interface XueanGroup {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  scholarCount: number;
  volumes: number[];
}

interface Dataset {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  dendrogram: DendrogramNode;
}

// ---------------------------------------------------------------------------
// Color generation (inlined from src/lib/colors.ts)
// ---------------------------------------------------------------------------

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateXueanColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    colors.push(hslToHex(hue, 70, 55));
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive xueanId from xueanPinyin: lowercase, kebab-case. */
function toXueanId(xueanPinyin: string): string {
  return xueanPinyin
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = __dirname;
const OUTPUT_DIR = join(SCRIPTS_DIR, "output");
const PROJECT_ROOT = join(SCRIPTS_DIR, "..");
const DATASET_DIR = join(PROJECT_ROOT, "public", "data");
const DATASET_PATH = join(DATASET_DIR, "dataset.json");

const SCHOLARS_PATH = join(OUTPUT_DIR, "scholars.json");
const POSITIONS_PATH = join(OUTPUT_DIR, "positions.json");
const CLUSTERING_PATH = join(OUTPUT_DIR, "clustering.json");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Validate inputs exist
  for (const [label, path] of [
    ["scholars.json", SCHOLARS_PATH],
    ["positions.json", POSITIONS_PATH],
    ["clustering.json", CLUSTERING_PATH],
  ] as const) {
    if (!existsSync(path)) {
      console.error(`Input file not found: ${path}`);
      console.error(`Run the earlier pipeline steps to generate ${label}`);
      process.exit(1);
    }
  }

  // Load inputs
  const rawScholars: RawScholar[] = JSON.parse(
    readFileSync(SCHOLARS_PATH, "utf-8")
  );
  const positions: PositionRecord[] = JSON.parse(
    readFileSync(POSITIONS_PATH, "utf-8")
  );
  const dendrogram: DendrogramNode = JSON.parse(
    readFileSync(CLUSTERING_PATH, "utf-8")
  );

  console.log(`Loaded ${rawScholars.length} scholars`);
  console.log(`Loaded ${positions.length} positions`);
  console.log("Loaded dendrogram");

  // Build position lookup by scholar ID
  const positionMap = new Map<string, PositionRecord>();
  for (const pos of positions) {
    positionMap.set(pos.id, pos);
  }

  // Merge positions into scholars and derive xueanId
  const scholars: Scholar[] = rawScholars.map((raw) => {
    const pos = positionMap.get(raw.id);
    if (!pos) {
      console.warn(`  No position data for scholar ${raw.id} (${raw.name})`);
    }

    return {
      id: raw.id,
      name: raw.name,
      namePinyin: raw.namePinyin,
      courtesy: raw.courtesy,
      title: raw.title,
      xueanId: toXueanId(raw.xueanPinyin),
      volume: raw.volume,
      section: raw.section,
      text: raw.text,
      umap: pos?.umap ?? [0, 0, 0],
      tsne: pos?.tsne ?? [0, 0, 0],
    };
  });

  console.log(`Merged ${scholars.length} scholars with positions`);

  // Build XueanGroup array from unique xuean values
  const xueanMap = new Map<
    string,
    { name: string; nameEn: string; scholarCount: number; volumes: Set<number> }
  >();

  for (const s of scholars) {
    const raw = rawScholars.find((r) => r.id === s.id)!;
    const existing = xueanMap.get(s.xueanId);
    if (existing) {
      existing.scholarCount++;
      existing.volumes.add(s.volume);
    } else {
      xueanMap.set(s.xueanId, {
        name: raw.xuean,
        nameEn: raw.xueanPinyin,
        scholarCount: 1,
        volumes: new Set([s.volume]),
      });
    }
  }

  const xueanIds = Array.from(xueanMap.keys());
  const colors = generateXueanColors(xueanIds.length);

  const xueanGroups: XueanGroup[] = xueanIds.map((id, i) => {
    const data = xueanMap.get(id)!;
    return {
      id,
      name: data.name,
      nameEn: data.nameEn,
      color: colors[i],
      scholarCount: data.scholarCount,
      volumes: Array.from(data.volumes).sort((a, b) => a - b),
    };
  });

  console.log(`Built ${xueanGroups.length} xuean groups`);

  // Ensure output directory exists
  if (!existsSync(DATASET_DIR)) {
    mkdirSync(DATASET_DIR, { recursive: true });
  }

  // Write final dataset
  const dataset: Dataset = { scholars, xueanGroups, dendrogram };
  writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), "utf-8");

  console.log(`\nDone. Wrote dataset to ${DATASET_PATH}`);
  console.log(`  ${scholars.length} scholars`);
  console.log(`  ${xueanGroups.length} xuean groups`);
}

main();
