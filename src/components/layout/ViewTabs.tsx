"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DendrogramView } from "@/components/clustering/DendrogramView";
import type { Scholar, XueanGroup, DendrogramNode } from "@/types";

const SceneCanvas = dynamic(
  () =>
    import("@/components/projector/SceneCanvas").then((m) => m.SceneCanvas),
  { ssr: false }
);

interface ViewTabsProps {
  scholars: Scholar[];
  xueanGroups: XueanGroup[];
  dendrogram: DendrogramNode;
  selectedId: string | null;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
}

export function ViewTabs({
  scholars,
  xueanGroups,
  dendrogram,
  selectedId,
  hiddenIds,
  onSelect,
}: ViewTabsProps) {
  return (
    <Tabs defaultValue="projector" className="flex h-full flex-col">
      <TabsList className="shrink-0">
        <TabsTrigger value="projector">Embedding Projector</TabsTrigger>
        <TabsTrigger value="dendrogram">Hierarchical Clustering</TabsTrigger>
      </TabsList>

      <TabsContent value="projector" className="min-h-0 flex-1">
        <SceneCanvas
          scholars={scholars}
          xueanGroups={xueanGroups}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onSelect={onSelect}
        />
      </TabsContent>

      <TabsContent value="dendrogram" className="min-h-0 flex-1">
        <DendrogramView
          dendrogram={dendrogram}
          scholars={scholars}
          xueanGroups={xueanGroups}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onSelect={onSelect}
        />
      </TabsContent>
    </Tabs>
  );
}
