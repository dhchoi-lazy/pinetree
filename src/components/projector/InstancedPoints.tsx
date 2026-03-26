"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scholar, XueanGroup } from "@/types";

interface InstancedPointsProps {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  algorithm: "umap" | "tsne";
  selectedId: string | null;
  hiddenIds: Set<string>;
  onHover: (
    scholar: Scholar | null,
    position?: [number, number, number]
  ) => void;
  onClick: (scholar: Scholar) => void;
}

const BASE_SIZE = 0.35;
const LERP_SPEED = 4;

const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();
const tempPosition = new THREE.Vector3();
const tempScale = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();

export function InstancedPoints({
  scholars,
  xueanGroups,
  algorithm,
  selectedId,
  hiddenIds,
  onHover,
  onClick,
}: InstancedPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const currentPositions = useRef<Float32Array | null>(null);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of xueanGroups) {
      map.set(group.id, group.color);
    }
    return map;
  }, [xueanGroups]);

  const targetPositions = useMemo(() => {
    const arr = new Float32Array(scholars.length * 3);
    for (let i = 0; i < scholars.length; i++) {
      const coords = scholars[i][algorithm];
      arr[i * 3] = coords[0];
      arr[i * 3 + 1] = coords[1];
      arr[i * 3 + 2] = coords[2];
    }
    return arr;
  }, [scholars, algorithm]);

  const geometry = useMemo(() => new THREE.SphereGeometry(BASE_SIZE, 16, 12), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!currentPositions.current) {
      currentPositions.current = new Float32Array(targetPositions);
    }

    const cur = currentPositions.current;
    const t = Math.min(1, delta * LERP_SPEED);

    for (let i = 0; i < scholars.length; i++) {
      const i3 = i * 3;

      // Lerp position toward target
      cur[i3] += (targetPositions[i3] - cur[i3]) * t;
      cur[i3 + 1] += (targetPositions[i3 + 1] - cur[i3 + 1]) * t;
      cur[i3 + 2] += (targetPositions[i3 + 2] - cur[i3 + 2]) * t;

      const scholar = scholars[i];
      const isHidden = hiddenIds.has(scholar.xueanId);
      const isHovered = hoveredIdRef.current === scholar.id;
      const isSelected = selectedId === scholar.id;

      // Determine scale
      let scale = 1;
      if (isSelected) scale = 1.5;
      else if (isHovered) scale = 1.2;

      tempPosition.set(cur[i3], cur[i3 + 1], cur[i3 + 2]);
      tempScale.setScalar(scale);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      mesh.setMatrixAt(i, tempMatrix);

      // Color with opacity baked into brightness
      const hex = colorMap.get(scholar.xueanId) ?? "#888888";
      tempColor.set(hex);

      if (isHidden) {
        // Dim filtered-out points
        tempColor.multiplyScalar(0.15);
      } else if (!isSelected && !isHovered) {
        tempColor.multiplyScalar(0.8);
      }

      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const idx = e.instanceId;
      if (idx === undefined || idx < 0 || idx >= scholars.length) return;

      const scholar = scholars[idx];
      hoveredIdRef.current = scholar.id;

      const coords = currentPositions.current;
      if (coords) {
        onHover(scholar, [
          coords[idx * 3],
          coords[idx * 3 + 1],
          coords[idx * 3 + 2],
        ]);
      } else {
        onHover(scholar, scholar[algorithm]);
      }
    },
    [scholars, algorithm, onHover]
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      hoveredIdRef.current = null;
      onHover(null);
    },
    [onHover]
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const idx = e.instanceId;
      if (idx === undefined || idx < 0 || idx >= scholars.length) return;
      onClick(scholars[idx]);
    },
    [scholars, onClick]
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, scholars.length]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={1}
        roughness={0.6}
        metalness={0.1}
      />
    </instancedMesh>
  );
}
