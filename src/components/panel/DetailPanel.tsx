"use client";

import type { Scholar, XueanGroup } from "@/types";
import { ScholarDetail } from "./ScholarDetail";
import { XueanFilter } from "./XueanFilter";

interface DetailPanelProps {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  selectedId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onToggleFilter: (id: string) => void;
}

export function DetailPanel({
  scholars,
  xueanGroups,
  selectedId,
  hiddenIds,
  onDeselect,
  onToggleFilter,
}: DetailPanelProps) {
  const selectedScholar = selectedId
    ? scholars.find((s) => s.id === selectedId) ?? null
    : null;
  const selectedGroup = selectedScholar
    ? xueanGroups.find((g) => g.id === selectedScholar.xueanId) ?? null
    : null;

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l bg-background">
      {selectedScholar && selectedGroup ? (
        <ScholarDetail
          scholar={selectedScholar}
          xueanGroup={selectedGroup}
          onBack={onDeselect}
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="shrink-0 px-4 pt-6 pb-4">
            <h1 className="text-xl font-bold tracking-tight">Pinetree</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Embedding projector for Song-Yuan Xuean
            </p>
          </div>

          <div className="shrink-0 px-4 pb-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Xuean Groups
            </h2>
          </div>

          <div className="min-h-0 flex-1 px-1">
            <XueanFilter
              groups={xueanGroups}
              hiddenIds={hiddenIds}
              onToggle={onToggleFilter}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
