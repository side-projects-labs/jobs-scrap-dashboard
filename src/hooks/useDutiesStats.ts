import { useEffect, useState } from "react";

export interface DutiesKeyword {
  keyword: string;
  count: number;
  percent: number;
}

interface DutiesStatsResponse {
  totalPostings: number;
  keywords: DutiesKeyword[];
  error?: string;
}

export function useDutiesStats() {
  const [keywords, setKeywords] = useState<DutiesKeyword[]>([]);
  const [totalPostings, setTotalPostings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/duties-stats")
      .then((r) => r.json() as Promise<DutiesStatsResponse>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (cancelled) return;
        setKeywords(data.keywords);
        setTotalPostings(data.totalPostings);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { keywords, totalPostings, loading, error };
}
