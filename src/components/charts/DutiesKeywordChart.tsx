import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { DutiesKeyword } from "@/hooks/useDutiesStats";

interface Props {
  data: DutiesKeyword[];
  totalPostings: number;
}

// 막대 하나가 차지하는 세로 길이 — 라벨이 겹치거나 걸러지지 않도록 항목 수에 비례해 높이를 잡는다
const ROW_HEIGHT = 26;

const COLORS = ["#60a5fa", "#818cf8", "#a78bfa", "#f472b6", "#fb923c", "#34d399"];

export default function DutiesKeywordChart({ data, totalPostings }: Props) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Recharts vertical layout 특성상 항목이 많으면 라벨이 쉽게 겹칩니다.
  // 모바일에서는 표시 개수/라벨을 줄여서 깨짐을 방지합니다.
  const displayData = isMobile ? data.slice(0, 10) : data;

  const chartHeight = displayData.length * ROW_HEIGHT + 40;
  const margin = isMobile
    ? { left: 20, right: 35, top: 10, bottom: 10 }
    : { left: 20, right: 60, top: 10, bottom: 10 };
  const yAxisWidth = isMobile ? 110 : 150;
  const tickFontSize = isMobile ? 10 : 11;
  const showPercentLabels = !isMobile;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 overflow-x-auto">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-700">주요업무 키워드 Top 20</h3>
      <p className="text-xs text-gray-400 mt-1 mb-3 sm:mb-4">
        업무 정보가 있는 공고 {totalPostings.toLocaleString()}건 중 해당 업무를 언급한 공고 비율입니다
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={displayData} layout="vertical" margin={margin}>
          <XAxis type="number" tick={{ fontSize: tickFontSize }} />
          <YAxis type="category" dataKey="keyword" tick={{ fontSize: tickFontSize }} width={yAxisWidth} interval={0} />
          <Tooltip
            formatter={(value, _, props) => [
              `${value}개 공고 (${props.payload.percent}%)`,
              "언급한 공고",
            ]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {showPercentLabels && (
              <LabelList
                dataKey="percent"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{ fontSize: tickFontSize, fill: "#6b7280" }}
              />
            )}
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
