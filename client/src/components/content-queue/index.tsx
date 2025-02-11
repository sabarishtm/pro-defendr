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
import { useToast } from "@/hooks/use-toast";

interface ContentQueueProps {
  onOpenModeration?: (item: ContentItem) => void;
}

export default function ContentQueue({ onOpenModeration }: ContentQueueProps) {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/content");
        if (response instanceof Response) {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          console.log("Content API response data:", data);
          if (!Array.isArray(data)) {
            console.error("Invalid response format, expected array:", data);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to load content items. Invalid data format.",
            });
            return [];
          }
          return data;
        }
        // If response is already parsed JSON
        if (Array.isArray(response)) {
          return response;
        }
        console.error("Unexpected response format:", response);
        return [];
      } catch (error) {
        console.error("Error fetching content:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load content items. Please try again.",
        });
        return [];
      }
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