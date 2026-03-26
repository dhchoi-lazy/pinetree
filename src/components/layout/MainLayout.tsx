"use client";

import type { Dataset } from "@/types";
import { ViewTabs } from "./ViewTabs";
import { DetailPanel } from "@/components/panel/DetailPanel";

interface MainLayoutProps {
  dataset: Dataset;
  selectedId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onToggleFilter: (id: string) => void;
}

export function MainLayout({
  dataset,
  selectedId,
  hiddenIds,
  onSelect,
  onDeselect,
  onToggleFilter,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen flex-row">
      <div className="min-w-0 flex-1">
        <ViewTabs
          scholars={dataset.scholars}
          xueanGroups={dataset.xueanGroups}
          dendrogram={dataset.dendrogram}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onSelect={onSelect}
        />
      </div>

      <DetailPanel
        scholars={dataset.scholars}
        xueanGroups={dataset.xueanGroups}
        selectedId={selectedId}
        hiddenIds={hiddenIds}
        onSelect={onSelect}
        onDeselect={onDeselect}
        onToggleFilter={onToggleFilter}
      />
    </div>
  );
}
