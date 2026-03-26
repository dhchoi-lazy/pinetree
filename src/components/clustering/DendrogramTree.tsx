import { hierarchy, cluster } from "d3-hierarchy";
import type { HierarchyPointNode } from "d3-hierarchy";
import { select } from "d3-selection";
import type { DendrogramNode, Scholar, XueanGroup } from "@/types";

const LEAF_RADIUS = 4;
const LABEL_OFFSET = 8;
const MARGIN = { top: 40, right: 20, bottom: 160, left: 20 };

type PointNode = HierarchyPointNode<DendrogramNode>;

function elbowLink(source: PointNode, target: PointNode): string {
  const my = (source.y + target.y) / 2;
  return `M${source.x},${source.y} C${source.x},${my} ${target.x},${my} ${target.x},${target.y}`;
}

function getAncestors(node: PointNode): Set<PointNode> {
  const set = new Set<PointNode>();
  let current: PointNode | null = node;
  while (current) {
    set.add(current);
    current = current.parent;
  }
  return set;
}

function getLeafIds(node: PointNode): Set<string> {
  const ids = new Set<string>();
  for (const leaf of node.leaves()) {
    if (leaf.data.id) ids.add(leaf.data.id);
  }
  return ids;
}

function buildScholarMap(scholars: Scholar[]): Map<string, Scholar> {
  const map = new Map<string, Scholar>();
  for (const s of scholars) {
    map.set(s.id, s);
  }
  return map;
}

function buildXueanColorMap(xueanGroups: XueanGroup[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of xueanGroups) {
    map.set(g.id, g.color);
  }
  return map;
}

export function renderDendrogram(params: {
  container: SVGGElement;
  dendrogram: DendrogramNode;
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  hiddenIds: Set<string>;
  selectedId: string | null;
  width: number;
  height: number;
  onSelect: (id: string) => void;
}): void {
  const {
    container,
    dendrogram,
    scholars,
    xueanGroups,
    hiddenIds,
    selectedId,
    width,
    height,
    onSelect,
  } = params;

  const scholarMap = buildScholarMap(scholars);
  const colorMap = buildXueanColorMap(xueanGroups);

  const root = hierarchy<DendrogramNode>(dendrogram, (d) => d.children ?? null);

  const leafCount = root.leaves().length;
  const dynamicWidth = Math.max(width, leafCount * 24);

  const layoutWidth = dynamicWidth - MARGIN.left - MARGIN.right;
  const layoutHeight = height - MARGIN.top - MARGIN.bottom;

  const clusterLayout = cluster<DendrogramNode>().size([
    layoutWidth,
    layoutHeight,
  ]);
  const layoutRoot = clusterLayout(root);

  const g = select(container);
  g.selectAll("*").remove();
  g.attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const allLinks = layoutRoot.links();
  const allNodes = layoutRoot.descendants();
  const leaves = layoutRoot.leaves();

  // Determine which leaf IDs are visible (not hidden by xuean filter)
  const visibleLeafIds = new Set<string>();
  for (const leaf of leaves) {
    const id = leaf.data.id;
    if (!id) continue;
    const scholar = scholarMap.get(id);
    if (!scholar) continue;
    if (!hiddenIds.has(scholar.xueanId)) {
      visibleLeafIds.add(id);
    }
  }

  // Check if a subtree contains any visible leaves
  function subtreeHasVisible(node: PointNode): boolean {
    const leafIds = getLeafIds(node);
    for (const id of leafIds) {
      if (visibleLeafIds.has(id)) return true;
    }
    return false;
  }

  // --- Links ---
  const linksGroup = g.append("g").attr("class", "links");
  linksGroup
    .selectAll("path")
    .data(allLinks)
    .join("path")
    .attr("d", (d) => elbowLink(d.source as PointNode, d.target as PointNode))
    .attr("fill", "none")
    .attr("stroke", "#334155")
    .attr("stroke-width", 1.2)
    .attr("opacity", (d) => {
      const targetVisible = subtreeHasVisible(d.target as PointNode);
      return targetVisible ? 0.8 : 0.15;
    });

  // --- Internal nodes ---
  const internalsGroup = g.append("g").attr("class", "internals");
  internalsGroup
    .selectAll("circle")
    .data(allNodes.filter((n) => n.children && n.children.length > 0))
    .join("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 2)
    .attr("fill", "#475569")
    .attr("opacity", (d) => (subtreeHasVisible(d) ? 0.5 : 0.15));

  // --- Leaf nodes ---
  const leavesGroup = g.append("g").attr("class", "leaves");
  const leafGroups = leavesGroup
    .selectAll<SVGGElement, PointNode>("g")
    .data(leaves)
    .join("g")
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("cursor", "pointer")
    .attr("opacity", (d) => {
      const id = d.data.id;
      if (!id) return 0.15;
      return visibleLeafIds.has(id) ? 1 : 0.15;
    });

  // Leaf circles
  leafGroups
    .append("circle")
    .attr("r", LEAF_RADIUS)
    .attr("fill", (d) => {
      const id = d.data.id;
      if (!id) return "#666";
      const scholar = scholarMap.get(id);
      if (!scholar) return "#666";
      return colorMap.get(scholar.xueanId) ?? "#666";
    })
    .attr("stroke", (d) => {
      const id = d.data.id;
      return id === selectedId ? "#f1f5f9" : "none";
    })
    .attr("stroke-width", (d) => {
      const id = d.data.id;
      return id === selectedId ? 2 : 0;
    });

  // Leaf labels
  leafGroups
    .append("text")
    .attr("x", 0)
    .attr("y", LABEL_OFFSET)
    .attr("text-anchor", "start")
    .attr("transform", `rotate(45)`)
    .attr("font-size", "11px")
    .attr("fill", "#94a3b8")
    .text((d) => {
      const id = d.data.id;
      if (!id) return "";
      const scholar = scholarMap.get(id);
      return scholar?.name ?? "";
    });

  // Click handler
  leafGroups.on("click", (_event, d) => {
    const id = d.data.id;
    if (id) onSelect(id);
  });

  // Hover: highlight subtree path
  leafGroups
    .on("mouseenter", function (_event, d) {
      const ancestors = getAncestors(d);

      // Highlight ancestor links with bright cyan
      linksGroup.selectAll("path")
        .attr("stroke", (linkData) => {
          const link = linkData as { source: PointNode; target: PointNode };
          if (ancestors.has(link.source) && ancestors.has(link.target)) {
            return "#38bdf8";
          }
          return "#334155";
        })
        .attr("stroke-width", (linkData) => {
          const link = linkData as { source: PointNode; target: PointNode };
          if (ancestors.has(link.source) && ancestors.has(link.target)) {
            return 2.5;
          }
          return 1.2;
        });

      // Highlight label
      select(this).select("text").attr("fill", "#e2e8f0").attr("font-weight", "bold");
      select(this).select("circle").attr("r", LEAF_RADIUS * 1.4);
    })
    .on("mouseleave", function () {
      // Reset links
      linksGroup
        .selectAll("path")
        .attr("stroke", "#334155")
        .attr("stroke-width", 1.2);

      // Reset label
      select(this).select("text").attr("fill", "#94a3b8").attr("font-weight", "normal");
      select(this).select("circle").attr("r", LEAF_RADIUS);
    });
}
