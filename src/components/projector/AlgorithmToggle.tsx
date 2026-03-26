"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AlgorithmToggleProps {
  algorithm: "umap" | "tsne";
  onChange: (algorithm: "umap" | "tsne") => void;
}

export function AlgorithmToggle({ algorithm, onChange }: AlgorithmToggleProps) {
  return (
    <div className="absolute left-3 top-3 z-10">
      <Tabs
        value={algorithm}
        onValueChange={(value: string | number | null) =>
          onChange(value as "umap" | "tsne")
        }
      >
        <TabsList>
          <TabsTrigger value="umap">UMAP</TabsTrigger>
          <TabsTrigger value="tsne">t-SNE</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
