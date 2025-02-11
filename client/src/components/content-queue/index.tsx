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
      console.log("API Response:", response);
      if (!Array.isArray(response)) {
        console.error("Invalid response format:", response);
        return [];
      }
      return response;
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