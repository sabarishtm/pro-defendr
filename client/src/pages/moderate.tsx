import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const { data: content, isLoading: isLoadingContent, error: contentError } = useQuery<ContentItem>({
    queryKey: ["/api/content", contentId],
    queryFn: async () => {
      const response = await apiRequest<ContentItem>("GET", `/api/content/${contentId}`);
      return response;
    },
    enabled: !isNaN(contentId),
  });

  const { data: case_ } = useQuery<ModerationCase>({
    queryKey: ["/api/cases", contentId],
    enabled: !isNaN(contentId),
  });

  if (isLoadingContent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!content || contentError) {
    return (
      <div className="p-8">
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
    <div className="p-8">
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