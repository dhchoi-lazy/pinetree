"use client";

import { useRef, useEffect } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import type { ZoomBehavior } from "d3-zoom";
import type { DendrogramNode, Scholar, XueanGroup } from "@/types";
import { renderDendrogram } from "./DendrogramTree";

interface DendrogramViewProps {
  dendrogram: DendrogramNode;
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  selectedId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
}

export function DendrogramView({
  dendrogram,
  scholars,
  xueanGroups,
  selectedId,
  hiddenIds,
  onSelect,
}: DendrogramViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Set up zoom behavior once
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        select(g).attr("transform", event.transform.toString());
      });

    zoomRef.current = zoomBehavior;
    select(svg).call(zoomBehavior);

    // Set initial transform to fit content
    select(svg).call(zoomBehavior.transform, zoomIdentity);

    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  // Render dendrogram when data changes
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const rect = svg.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    renderDendrogram({
      container: g,
      dendrogram,
      scholars,
      xueanGroups,
      hiddenIds,
      selectedId,
      width,
      height,
      onSelect,
    });
  }, [dendrogram, scholars, xueanGroups, hiddenIds, selectedId, onSelect]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full"
      style={{ background: "#0a0a0f" }}
    >
      <g ref={gRef} />
    </svg>
  );
}
