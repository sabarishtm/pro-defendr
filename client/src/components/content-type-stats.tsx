import { useQuery } from "@tanstack/react-query";
import { ContentItem } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ContentTypeStats() {
  const { data: content = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  // Group content by type and calculate processing time
  const contentTypeData = content.reduce((acc, item) => {
    const type = item.type;
    if (!acc[type]) {
      acc[type] = { type, count: 0, avgProcessingTime: 0 };
    }
    acc[type].count++;
    // Mock processing time between 30-120 seconds
    acc[type].avgProcessingTime = Math.floor(Math.random() * 90) + 30;
    return acc;
  }, {} as Record<string, { type: string; count: number; avgProcessingTime: number }>);

  const chartData = Object.values(contentTypeData);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis
            dataKey="type"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ 
              value: 'Processing Time (s)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip />
          <Bar
            dataKey="avgProcessingTime"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
