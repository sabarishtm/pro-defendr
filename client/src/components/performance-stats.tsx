import { useQuery } from "@tanstack/react-query";
import { Case } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function PerformanceStats() {
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  // Group cases by date and count decisions
  const trendData = cases.reduce((acc, case_) => {
    const date = new Date(case_.createdAt).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, approved: 0, rejected: 0, review: 0 };
    }
    if (case_.decision) {
      acc[date][case_.decision]++;
    }
    return acc;
  }, {} as Record<string, { date: string; approved: number; rejected: number; review: number }>);

  // Convert to array and sort by date
  const chartData = Object.values(trendData).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="approved"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="rejected"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="review"
            stroke="hsl(var(--warning))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}