/// <reference types="node" />
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// 주요 업무 키워드 상위 20개를 DB에서 집계해 돌려준다
// 키워드 사전은 supabase/migrations의 get_duties_keyword_stats 함수에 있고
// 모든 업무 문장을 직접 세므로 표본이나 LLM 추정 없이 같은 입력이면 항상 같은 결과가 나온다
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc("get_duties_keyword_stats", { top_n: 20 });

  if (error) return res.status(500).json({ error: error.message });

  // 집계에 1초 넘게 걸리고 값이 자주 바뀌지 않아 CDN에 한 시간 보관한다
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json(data);
}
