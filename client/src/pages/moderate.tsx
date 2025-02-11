import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CaseDetails } from "@/components/moderation/case-details";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function ModeratePage({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contentId = parseInt(params.id);

  const { data: content, isLoading: isLoadingContent } = useQuery<ContentItem>({
    queryKey: ["/api/content", contentId],
    enabled: !isNaN(contentId),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const content = await apiRequest("POST", `/api/content/${contentId}/assign`, {
        agentId: 1 // Hardcoded for demo
      });

      const case_ = await apiRequest("POST", "/api/cases", {
        contentId,
        agentId: 1,
      });

      return { content, case: case_ };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content", contentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign content. Please try again."
      });
    }
  });

  const { data: case_ } = useQuery<ModerationCase>({
    queryKey: ["/api/cases", contentId],
    enabled: !isNaN(contentId),
  });

  if (isLoadingContent || assignMutation.isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold">Content not found</h1>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <CaseDetails
        contentItem={content}
        moderationCase={case_}
        onComplete={() => {
          setLocation("/queue");
          queryClient.invalidateQueries({ queryKey: ["/api/content"] });
        }}
      />
    </div>
  );
}
