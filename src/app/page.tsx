"use client";

import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/hooks/useSelection";
import { useFilter } from "@/hooks/useFilter";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Home() {
  const { dataset, loading, error } = useDataset();
  const { selectedId, select, deselect } = useSelection();
  const { hiddenIds, toggle } = useFilter();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-destructive">
          Failed to load dataset{error ? `: ${error}` : ""}
        </p>
      </div>
    );
  }

  return (
    <MainLayout
      dataset={dataset}
      selectedId={selectedId}
      hiddenIds={hiddenIds}
      onSelect={select}
      onDeselect={deselect}
      onToggleFilter={toggle}
    />
  );
}
