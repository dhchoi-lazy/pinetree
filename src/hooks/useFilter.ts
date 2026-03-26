"use client";

import { useState, useCallback } from "react";

export function useFilter() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (xueanId: string) => !hiddenIds.has(xueanId),
    [hiddenIds]
  );

  return { hiddenIds, toggle, isVisible };
}
