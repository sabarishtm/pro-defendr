import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import type { ContentItem } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ContentQueueProps {
  onOpenModeration?: (item: ContentItem) => void;
}

export default function ContentQueue({ onOpenModeration }: ContentQueueProps) {
  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/content");
      if (response instanceof Response) {
        const data = await response.json();
        console.log("Parsed API Response:", data);
        if (!Array.isArray(data)) {
          console.error("Invalid response format:", data);
          return [];
        }
        return data;
      }
      return response; // If it's already parsed JSON
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Queue</CardTitle>
          <CardDescription>Loading content items...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Queue</CardTitle>
        <CardDescription>
          Review and moderate content items in the queue ({items.length} items)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
          columns={columns} 
          data={items} 
          onOpenModeration={onOpenModeration}
        />
      </CardContent>
    </Card>
  );
}