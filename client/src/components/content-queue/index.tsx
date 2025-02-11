import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
        const data = await apiRequest("GET", "/api/content");
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
        <div>
          <CardTitle>Content Queue</CardTitle>
          <CardDescription>
            Review and moderate content items in the queue ({items.length} items)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* We'll implement the table here */}
        <pre>{JSON.stringify(items, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}