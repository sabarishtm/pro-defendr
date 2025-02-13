import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function PerformanceStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  if (isLoading || !stats) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
        Loading statistics...
      </div>
    );
  }

  // Format moderation trends data
  const chartData = stats.moderationTrends?.map(trend => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    reviewed: trend.count
  })) || [];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            name="Reviews"
            type="monotone"
            dataKey="reviewed"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}