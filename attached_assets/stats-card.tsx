import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type StatsCardProps = {
  title: string;
  value?: number;
  data?: Record<string, number>;
  loading?: boolean;
};

export default function StatsCard({ title, value, data, loading }: StatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
        ) : value !== undefined ? (
          <p className="text-3xl font-bold">{value}</p>
        ) : data ? (
          <div className="space-y-1">
            {Object.entries(data).map(([key, count]) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize">{key}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
