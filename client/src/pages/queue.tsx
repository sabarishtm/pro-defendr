import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueueItem } from "@/components/moderation/queue-item";
import { CaseDetails } from "@/components/moderation/case-details";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ContentItem, ModerationCase } from "@shared/schema";

export default function Queue() {
  const [activeCase, setActiveCase] = useState<{
    content: ContentItem;
    case: ModerationCase;
  } | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: nextItem, isLoading } = useQuery<ContentItem>({
    queryKey: ["/api/content/next"],
    enabled: !activeCase,
  });

  const assignMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const content = await apiRequest("POST", `/api/content/${contentId}/assign`, {
        agentId: 1 // Hardcoded for demo
      });
      
      const case_ = await apiRequest("POST", "/api/cases", {
        contentId,
        agentId: 1,
      });
      
      return { content, case_ };
    },
    onSuccess: (data) => {
      setActiveCase({
        content: data.content,
        case: data.case_
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/next"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign content. Please try again."
      });
    }
  });

  function handleComplete() {
    setActiveCase(null);
    queryClient.invalidateQueries({ queryKey: ["/api/content/next"] });
  }

  if (activeCase) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <CaseDetails
          contentItem={activeCase.content}
          moderationCase={activeCase.case}
          onComplete={handleComplete}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Moderation Queue</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : nextItem ? (
        <QueueItem
          item={nextItem}
          onAssign={() => assignMutation.mutate(nextItem.id)}
        />
      ) : (
        <Alert>
          <AlertDescription>
            No content items waiting for review.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
