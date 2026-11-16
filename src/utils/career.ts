// 다양한 경력 표기를 정규화된 레이블로 통합
export function normalizeCareer(raw: string): string {
  if (/신입.{0,3}경력|경력.{0,3}신입/i.test(raw)) return "신입·경력";
  const yearMatch = raw.match(/경력\s*(\d+)\s*년/);
  if (yearMatch) return `경력 ${yearMatch[1]}년 이상`;
  return raw;
}

export interface CareerStat {
  career: string;
  count: number;
  percent: number;
}

// 차트에 보여 줄 경력 항목 수의 기본 상한
export const CAREER_CHART_TOP_N = 8;

// "경력 N년 이상"·"경력 N~M년" 같은 연차 표기를 하한 연차 기준 구간으로 묶는다
// 연차가 없는 레이블(상시채용·신입·경력무관·경력 등)은 그대로 둔다
function careerRange(label: string): string {
  const match = label.match(/^경력\s*(\d+)/);
  if (!match) return label;
  const years = Number(match[1]);
  if (years <= 3) return "1~3년";
  if (years <= 6) return "4~6년";
  if (years <= 9) return "7~9년";
  return "10년 이상";
}

// 경력 차트의 표시 순서 — 신입에서 시작해 연차가 올라가고 연차와 무관한 항목이 마지막에 온다
export const CAREER_CHART_ORDER = [
  "신입",
  "신입·경력",
  "1~3년",
  "4~6년",
  "7~9년",
  "10년 이상",
  "경력",
  "경력무관",
  "상시채용",
];

// 공고 목록 경력 필터 칩의 표시 순서 — 차트와 같은 흐름이며 연차 구간은 "경력" 하나로 묶인다
export const CAREER_FILTER_ORDER = ["신입", "신입·경력", "경력", "경력무관", "상시채용"];

function careerOrderIndex(label: string): number {
  const index = CAREER_CHART_ORDER.indexOf(label);
  return index === -1 ? CAREER_CHART_ORDER.length : index;
}

// 경력 분포를 구간으로 통합하고 공고가 많은 상위 N개를 고른 뒤 정해진 순서로 정렬한다
// 퍼센트는 통합 뒤 다시 계산하며 분모는 전체 집계 건수라서 SQL 집계와 같은 기준이다
export function groupCareerStats(stats: CareerStat[], topN: number = CAREER_CHART_TOP_N): CareerStat[] {
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return [];

  const merged = new Map<string, number>();
  for (const { career, count } of stats) {
    const key = careerRange(career);
    merged.set(key, (merged.get(key) ?? 0) + count);
  }

  return [...merged]
    .map(([career, count]) => ({ career, count, percent: Math.round((count * 100) / total) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .sort((a, b) => careerOrderIndex(a.career) - careerOrderIndex(b.career) || b.count - a.count);
}

// 정규화된 경력 레이블 → 필터 카테고리 매핑
export function careerFilterCategory(label: string): string {
  if (label === "상시채용") return "상시채용";
  if (label === "신입·경력") return "신입·경력";
  if (/^신입$/.test(label)) return "신입";
  if (/경력무관/.test(label)) return "경력무관";
  if (/^경력/.test(label)) return "경력";
  return label;
}
