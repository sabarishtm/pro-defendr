import { useQuery } from "@tanstack/react-query";
import { Case } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export default function PerformanceStats() {
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const stats = cases.reduce(
    (acc, case_) => {
      if (case_.decision === "approved") acc.approved++;
      if (case_.decision === "rejected") acc.rejected++;
      return acc;
    },
    { approved: 0, rejected: 0 }
  );

  const data = [
    { name: "Approved", value: stats.approved },
    { name: "Rejected", value: stats.rejected },
  ];

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Stats</CardTitle>
        <CardDescription>Your moderation decisions overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
