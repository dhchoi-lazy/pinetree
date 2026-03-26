"use client";

import { useState, useEffect } from "react";
import type { Dataset } from "@/types";

export function useDataset() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const basePath = process.env.NODE_ENV === "production" ? "/pinetree" : "";
    fetch(`${basePath}/data/dataset.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setDataset)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { dataset, loading, error };
}
