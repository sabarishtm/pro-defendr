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
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ContentQueueProps {
  onOpenModeration?: (item: ContentItem) => void;
}

export default function ContentQueue({ onOpenModeration }: ContentQueueProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter items based on search query
  const filteredItems = items.filter((item) => 
    item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex flex-col space-y-4">
          <div>
            <CardTitle>Content Queue</CardTitle>
            <CardDescription>
              Review and moderate content items in the queue ({items.length} items)
            </CardDescription>
          </div>
          <Input
            placeholder="Search content, type, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <DataTable 
          columns={columns} 
          data={filteredItems} 
          onOpenModeration={onOpenModeration}
        />
      </CardContent>
    </Card>
  );
}