"use client";

import { Html } from "@react-three/drei";
import type { Scholar, XueanGroup } from "@/types";

interface PointTooltipProps {
  scholar: Scholar | null;
  xueanGroup?: XueanGroup;
  position?: [number, number, number];
}

export function PointTooltip({
  scholar,
  xueanGroup,
  position,
}: PointTooltipProps) {
  if (!scholar || !position) return null;

  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div
        className="rounded-lg border border-white/10 bg-[#0a0a0f]/90 px-3 py-2 shadow-lg backdrop-blur-sm"
        style={{ pointerEvents: "none" }}
      >
        <p className="whitespace-nowrap text-sm font-medium text-white">
          {scholar.namePinyin}
          <span className="ml-2 text-white/70">{scholar.name}</span>
        </p>
        {xueanGroup && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: xueanGroup.color }}
            />
            {xueanGroup.nameEn}
          </p>
        )}
      </div>
    </Html>
  );
}
