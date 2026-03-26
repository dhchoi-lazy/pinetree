"use client";

import { useState, useCallback } from "react";

export function useSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const select = useCallback((id: string) => setSelectedId(id), []);
  const deselect = useCallback(() => setSelectedId(null), []);

  return { selectedId, select, deselect };
}
