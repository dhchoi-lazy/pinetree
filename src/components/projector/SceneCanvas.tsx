"use client";

import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Scholar, XueanGroup } from "@/types";
import { InstancedPoints } from "./InstancedPoints";
import { PointTooltip } from "./PointTooltip";
import { AlgorithmToggle } from "./AlgorithmToggle";

interface SceneCanvasProps {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  selectedId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
}

export function SceneCanvas({
  scholars,
  xueanGroups,
  selectedId,
  hiddenIds,
  onSelect,
}: SceneCanvasProps) {
  const [algorithm, setAlgorithm] = useState<"umap" | "tsne">("umap");
  const [hoveredScholar, setHoveredScholar] = useState<Scholar | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<
    [number, number, number] | undefined
  >(undefined);

  const hoveredGroup = hoveredScholar
    ? xueanGroups.find((g) => g.id === hoveredScholar.xueanId)
    : undefined;

  const handleHover = useCallback(
    (scholar: Scholar | null, position?: [number, number, number]) => {
      setHoveredScholar(scholar);
      setHoveredPosition(position);
    },
    []
  );

  const handleClick = useCallback(
    (scholar: Scholar) => {
      onSelect(scholar.id);
    },
    [onSelect]
  );

  return (
    <div className="relative h-full w-full">
      <AlgorithmToggle algorithm={algorithm} onChange={setAlgorithm} />

      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        style={{ background: "#0a0a0f" }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[50, 50, 50]} intensity={0.8} />

        <InstancedPoints
          scholars={scholars}
          xueanGroups={xueanGroups}
          algorithm={algorithm}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onHover={handleHover}
          onClick={handleClick}
        />

        <PointTooltip
          scholar={hoveredScholar}
          xueanGroup={hoveredGroup}
          position={hoveredPosition}
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.12}
          minDistance={5}
          maxDistance={200}
        />
      </Canvas>
    </div>
  );
}
