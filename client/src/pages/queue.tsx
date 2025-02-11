import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ContentQueue from "@/components/content-queue";
import { CaseDetails } from "@/components/moderation/case-details";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ContentItem } from "@shared/schema";

export default function Queue() {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const { toast } = useToast();

  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const response = await apiRequest("POST", `/api/content/${contentId}/assign`, {
        agentId: 1 // Hardcoded for demo
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Content assigned",
        description: "The content item has been assigned to you for moderation.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign content. Please try again.",
      });
    }
  });

  const handleOpenModeration = (item: ContentItem) => {
    setSelectedItem(item);
    assignMutation.mutate(item.id);
  };

  if (assignMutation.isPending) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedItem) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <CaseDetails
          contentItem={selectedItem}
          onComplete={() => {
            setSelectedItem(null);
            queryClient.invalidateQueries({ queryKey: ["/api/content"] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <ContentQueue onOpenModeration={handleOpenModeration} />
    </div>
  );
}