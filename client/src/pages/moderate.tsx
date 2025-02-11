import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CaseDetails } from "@/components/moderation/case-details";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ModeratePage({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contentId = parseInt(params.id);
  console.log("ModeratePage - Content ID:", contentId);

  const { data: content, isLoading: isLoadingContent, error: contentError } = useQuery<ContentItem>({
    queryKey: ["/api/content", contentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/content/${contentId}`);
      console.log("API Response for content:", response);
      return response;
    },
    enabled: !isNaN(contentId),
  });

  console.log("ModeratePage - Fetched content:", content);

  const { data: case_ } = useQuery<ModerationCase>({
    queryKey: ["/api/cases", contentId],
    enabled: !isNaN(contentId),
  });

  console.log("ModeratePage - Fetched case:", case_);

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

  if (isLoadingContent || assignMutation.isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!content || contentError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Content not found (ID: {contentId}). This content may have been deleted or is not accessible.
          </AlertDescription>
        </Alert>
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