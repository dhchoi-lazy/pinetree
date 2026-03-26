# Pinetree: Embedding Projector for 宋元學案

## Purpose

Pinetree is a static web application that visualizes scholar entries from 宋元學案 (Song-Yuan Xuean) as a 3D embedding projection with two views: an **Embedding Projector** and a **Hierarchical Clustering** view. The research question: **do embedding-based clusters (textual similarity) align with the traditional 學案 (academic lineage) categorizations?**

Scholars are colored by their 學案 affiliation. If same-colored points cluster together in embedding space, the traditional lineage groupings reflect genuine textual/intellectual similarity. Divergences reveal cross-lineage intellectual influence.

## Constraints

- **Static deployment**: GitHub Pages (deployed via `gh-pages`). No server, no database, no runtime API calls.
- **Pre-computed data**: All embeddings, dimensionality reductions, and metadata are computed offline and bundled as JSON.
- **Single-page app**: Next.js with `output: 'export'`.

## Data Source

- **Text**: 103 volumes of 宋元學案, ~4.7MB of punctuated classical Chinese, stored in `data/*.txt`
- **Structure**: Each volume contains entries on individual scholars organized by 學案 (intellectual lineage), with `◆` markers separating relationship groups within volumes.

## Preprocessing Pipeline

Five sequential scripts in `scripts/`, each producing intermediate JSON in `scripts/output/`:

### Step 1: Scholar Splitter (Gemini Agent)

A Gemini agent processes each volume to extract individual scholar entries.

**Input**: `data/*.txt` (103 volume files)
**Output**: `scripts/output/scholars.json`

For each scholar, extracts:
- `id`: Unique identifier (e.g., `"v001-hu-yuan"`)
- `name`: Chinese name (e.g., `"胡瑗"`)
- `namePinyin`: Pinyin transliteration (e.g., `"Hu Yuan"`)
- `courtesy`: Courtesy name / 字 (e.g., `"翼之"`)
- `title`: Posthumous title or official title (e.g., `"文昭"`)
- `xuean`: 學案 name (e.g., `"安定學案"`)
- `xueanPinyin`: Pinyin transliteration of 學案 name (e.g., `"Anding"`)
- `volume`: Volume number
- `section`: The `◆` section header (e.g., `"安定門人"`)
- `text`: Full scholar entry text with proper punctuation

The agent also adds/corrects punctuation in the extracted text and produces Pinyin transliterations for all Chinese names.

### Step 2: Embedding Generator (Gemini Embedding)

Generates vector embeddings for each scholar's text.

**Input**: `scripts/output/scholars.json`
**Output**: `scripts/output/embeddings.json`

- **Model**: `gemini-embedding-exp-03-07` (Gemini Embedding 2 Preview) via Vertex AI
- **SDK**: `@google/genai` with Vertex AI mode
- **Auth**: GCP Application Default Credentials (`gcloud auth application-default login`)
- **Project**: `regal-hybrid-472613-u2`
- **Batched**: Multiple scholars per API call for efficiency
- **Output format**: `[{id, vector: number[]}, ...]`

### Step 3: Dimensionality Reduction (UMAP + t-SNE)

Reduces high-dimensional embeddings to 3D coordinates using both algorithms.

**Input**: `scripts/output/embeddings.json`
**Output**: `scripts/output/positions.json`

- **UMAP**: `umap-js` (Node.js), params: `nNeighbors: 15`, `minDist: 0.1`, `nComponents: 3`
- **t-SNE**: `@anthropic-ai/tsne-js` or equivalent WASM-based implementation, params: `perplexity: 30`, `dimensions: 3`
- **Normalization**: Scale both to [-20, 20] range centered at origin
- **Output format**: `[{id, umap: [x, y, z], tsne: [x, y, z]}, ...]`

### Step 4: Hierarchical Clustering

Computes hierarchical (agglomerative) clustering from raw embedding vectors.

**Input**: `scripts/output/embeddings.json`, `scripts/output/scholars.json`
**Output**: `scripts/output/clustering.json`

- **Algorithm**: Agglomerative hierarchical clustering on raw embedding vectors
- **Library**: `ml-hclust` or similar (Node.js)
- **Linkage**: Ward's method (minimizes within-cluster variance)
- **Distance metric**: Cosine distance
- **Output**: Dendrogram tree structure with scholar IDs at leaves, merge heights at internal nodes
- **Output format**: Tree structure suitable for rendering as a dendrogram

### Step 5: Bundle for Frontend

Merges all intermediate data into a single dataset for the browser.

**Input**: All `scripts/output/*.json` files
**Output**: `public/data/dataset.json`

- Merges scholars, positions (both UMAP and t-SNE), clustering tree, and xuean groupings
- Derives `xueanId` by slugifying the `xuean` name (e.g., `"安定學案"` → `"anding"`)
- Builds `XueanGroup` entries from unique xuean values, using `xueanPinyin` for `nameEn`
- Generates color map for each 學案 (HSL palette, evenly spaced hues)
- Computes scholar counts and volume lists per 學案
- Does NOT include raw embedding vectors (too large for browser)

## Data Model

```typescript
interface Dataset {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  dendrogram: DendrogramNode;
}

interface Scholar {
  id: string;
  name: string;
  namePinyin: string;
  courtesy: string;
  title: string;
  xueanId: string;          // Slugified from xuean name (e.g., "anding")
  volume: number;
  section: string;
  text: string;
  umap: [number, number, number];   // Pre-computed UMAP position
  tsne: [number, number, number];   // Pre-computed t-SNE position
}

interface XueanGroup {
  id: string;               // Slugified (e.g., "anding")
  name: string;             // Chinese (e.g., "安定學案")
  nameEn: string;           // Pinyin from Gemini (e.g., "Anding")
  color: string;
  scholarCount: number;
  volumes: number[];
}

interface DendrogramNode {
  id?: string;              // Scholar ID (leaf nodes only)
  children?: [DendrogramNode, DendrogramNode]; // Internal nodes
  height: number;           // Merge distance (0 for leaves)
}
```

## Frontend Architecture

### Tech Stack

- **Framework**: Next.js (static export via `output: 'export'`)
- **UI**: shadcn/ui + Tailwind CSS
- **3D**: Three.js via React Three Fiber (@react-three/fiber, @react-three/drei)
- **Dendrogram**: D3.js (`d3-hierarchy`, `d3-selection`) for hierarchical clustering view
- **State**: React hooks + context (no external state library)
- **Deployment**: GitHub Pages via `gh-pages`
- **Scaffolding**: `create-next-app`

### Two-Tab Layout

The app has two main views, switchable via tabs at the top:

**Tab 1: Embedding Projector**
- 3D scatter plot of scholars in embedding space
- Toggle between UMAP and t-SNE projections
- Right panel with scholar detail + xuean filter

**Tab 2: Hierarchical Clustering**
- Dendrogram visualization of agglomerative clustering
- Scholars as leaves, colored by 學案
- Right panel with scholar detail + xuean filter (shared)

### Component Structure

```
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   ├── ViewTabs.tsx            # Tab switcher (Projector / Clustering)
│   │   └── MainLayout.tsx          # Shared layout with right panel
│   ├── projector/
│   │   ├── SceneCanvas.tsx         # R3F Canvas + OrbitControls
│   │   ├── InstancedPoints.tsx     # Instanced mesh rendering
│   │   └── AlgorithmToggle.tsx     # UMAP / t-SNE switch
│   ├── clustering/
│   │   ├── DendrogramView.tsx      # D3 dendrogram container
│   │   └── DendrogramTree.tsx      # D3 tree rendering + zoom/pan
│   ├── panel/
│   │   ├── DetailPanel.tsx         # Right panel container
│   │   ├── ScholarDetail.tsx       # Scholar info + text
│   │   └── XueanFilter.tsx         # Xuean toggle filter list
│   └── ui/                         # shadcn components
├── hooks/
│   ├── useDataset.ts               # Load & parse dataset.json
│   ├── useSelection.ts             # Selected scholar state
│   └── useFilter.ts                # Xuean filter state
├── lib/
│   └── colors.ts                   # Xuean color mapping
├── types/
│   └── index.ts                    # Scholar, XueanGroup, DendrogramNode types
└── public/
    └── data/
        └── dataset.json
```

### Embedding Projector (Tab 1)

**Layout**: Canvas + Right Panel. Full-height 3D canvas on the left, collapsible right panel (fixed width).

**Algorithm Toggle**: Small control above or overlaying the canvas to switch between UMAP and t-SNE. Switching animates points to their new positions.

**Panel States**:

Default (no selection):
- Project title: "Pinetree"
- Subtitle: "Embedding projector for Song-Yuan Xuean"
- Xuean filter list: Each 學案 shown as a row with color dot, English name, and scholar count
- Clicking a 學案 toggles its visibility in the canvas

Scholar selected:
- "Back to filters" link at top
- Scholar name in English transliteration + Chinese (e.g., "Hu Yuan (胡瑗)")
- Courtesy name and title
- 學案 badge (colored) + volume number
- Scrollable full text of the scholar entry

**Interactions**:
- Orbit (left-drag), zoom (scroll), pan (right-drag)
- Hover: tooltip with scholar name + 學案
- Click: opens scholar detail in right panel
- Xuean filter: toggle on/off, filtered-out points dim to 0.15 opacity

**Point Visual States**:

| State | Appearance |
|-------|-----------|
| Default | Base size, 0.8 opacity, 學案 color |
| Hovered | 1.2x scale, 1.0 opacity, subtle ring |
| Selected | 1.5x scale, 1.0 opacity, bright ring |
| Filtered out | Base size, 0.15 opacity |

**Rendering**:
- InstancedMesh for all scholar points (single draw call)
- Sphere geometry, shared across all instances
- Color and opacity set per-instance via instance attributes

### Hierarchical Clustering (Tab 2)

**Layout**: Dendrogram + Right Panel. Same panel structure as the projector tab (shared state).

**Dendrogram**:
- Rendered with D3.js (`d3-hierarchy` + `d3-cluster` or `d3-tree`)
- Horizontal layout: root on the left, leaves (scholars) on the right
- Leaf nodes labeled with scholar name, colored by 學案
- Zoomable and pannable (D3 zoom behavior)
- Click a leaf node to open scholar detail in right panel

**Interactions**:
- Zoom/pan the dendrogram
- Click leaf: opens scholar detail in shared right panel
- Hover leaf: highlight the scholar's subtree
- Xuean filter: same filter, dims non-matching branches

## UI Language

- **All interface text in English**: labels, buttons, filter names, tooltips, tab names
- **Scholar content in Chinese**: names (shown alongside English transliteration), biographical text, 學案 names shown in both English and Chinese where appropriate

## Deployment

- Next.js `output: 'export'` generates static files in `out/`
- Deploy to GitHub Pages via `gh-pages` npm package
- `.nojekyll` file to prevent Jekyll processing
- Base path configured for GitHub Pages URL (`/<repo-name>/`)

## Out of Scope

- Clustering labels (no LLM-generated labels)
- Box selection
- Database or server-side processing
- Real-time embedding computation
- Search functionality
- PCA algorithm
