"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
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

const POINT_SIZE = 8;
const LERP_SPEED = 4;

export function InstancedPoints({
  scholars,
  xueanGroups,
  algorithm,
  selectedId,
  hiddenIds,
  onHover,
  onClick,
}: InstancedPointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const currentPositions = useRef<Float32Array | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const { camera, gl } = useThree();

  const colorMap = useMemo(() => {
    const map = new Map<string, THREE.Color>();
    for (const group of xueanGroups) {
      map.set(group.id, new THREE.Color(group.color));
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

  const initialColors = useMemo(() => {
    const arr = new Float32Array(scholars.length * 3);
    const dimColor = new THREE.Color("#1a1a2e");
    const tempColor = new THREE.Color();
    for (let i = 0; i < scholars.length; i++) {
      const scholar = scholars[i];
      const baseColor = colorMap.get(scholar.xueanId);
      tempColor.copy(baseColor ?? new THREE.Color("#888888"));
      arr[i * 3] = tempColor.r;
      arr[i * 3 + 1] = tempColor.g;
      arr[i * 3 + 2] = tempColor.b;
    }
    return arr;
  }, [scholars, colorMap]);

  const sizes = useMemo(
    () => new Float32Array(scholars.length).fill(POINT_SIZE),
    [scholars.length]
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(targetPositions), 3)
    );
    geo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Float32Array(initialColors), 3)
    );
    geo.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(new Float32Array(sizes), 1)
    );
    return geo;
  }, [scholars.length]);

  // Update colors when filter/selection changes
  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const posAttr = points.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const colorAttr = points.geometry.getAttribute(
      "color"
    ) as THREE.BufferAttribute;
    const sizeAttr = points.geometry.getAttribute(
      "size"
    ) as THREE.BufferAttribute;

    if (!currentPositions.current) {
      currentPositions.current = new Float32Array(targetPositions);
    }

    const cur = currentPositions.current;
    const t = Math.min(1, delta * LERP_SPEED);
    const dimColor = new THREE.Color("#1a1a2e");
    const tempColor = new THREE.Color();

    for (let i = 0; i < scholars.length; i++) {
      const i3 = i * 3;
      const scholar = scholars[i];

      // Lerp positions
      cur[i3] += (targetPositions[i3] - cur[i3]) * t;
      cur[i3 + 1] += (targetPositions[i3 + 1] - cur[i3 + 1]) * t;
      cur[i3 + 2] += (targetPositions[i3 + 2] - cur[i3 + 2]) * t;

      posAttr.setXYZ(i, cur[i3], cur[i3 + 1], cur[i3 + 2]);

      // Colors
      const isHidden = hiddenIds.has(scholar.xueanId);
      const isHovered = hoveredIdRef.current === scholar.id;
      const isSelected = selectedId === scholar.id;

      const baseColor = colorMap.get(scholar.xueanId);
      tempColor.copy(baseColor ?? new THREE.Color("#888888"));

      if (isHidden) {
        tempColor.lerp(dimColor, 0.85);
      }

      colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);

      // Sizes
      let size = POINT_SIZE;
      if (isSelected) size = POINT_SIZE * 1.8;
      else if (isHovered) size = POINT_SIZE * 1.4;
      else if (isHidden) size = POINT_SIZE * 0.5;

      sizeAttr.setX(i, size);
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  // Raycasting for hover/click
  useEffect(() => {
    const canvas = gl.domElement;

    raycaster.current.params.Points = { threshold: 0.5 };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointer.current, camera);
      const points = pointsRef.current;
      if (!points) return;

      const intersects = raycaster.current.intersectObject(points);
      if (intersects.length > 0 && intersects[0].index !== undefined) {
        const idx = intersects[0].index;
        const scholar = scholars[idx];
        if (hoveredIdRef.current !== scholar.id) {
          hoveredIdRef.current = scholar.id;
          const pos = currentPositions.current;
          if (pos) {
            onHover(scholar, [
              pos[idx * 3],
              pos[idx * 3 + 1],
              pos[idx * 3 + 2],
            ]);
          } else {
            onHover(scholar, scholar[algorithm]);
          }
        }
      } else {
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          onHover(null);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointer.current, camera);
      const points = pointsRef.current;
      if (!points) return;

      const intersects = raycaster.current.intersectObject(points);
      if (intersects.length > 0 && intersects[0].index !== undefined) {
        onClick(scholars[intersects[0].index]);
      }
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [gl, camera, scholars, algorithm, onHover, onClick]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={POINT_SIZE}
        sizeAttenuation={false}
        transparent
        opacity={1}
      />
    </points>
  );
}
