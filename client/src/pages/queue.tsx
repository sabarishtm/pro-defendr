import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueueItem } from "@/components/moderation/queue-item";
import { CaseDetails } from "@/components/moderation/case-details";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ContentQueue from "@/components/content-queue"; // Changed to default import
import type { ContentItem, ModerationCase } from "@shared/schema";

export default function Queue() {
  const [activeCase, setActiveCase] = useState<{
    content: ContentItem;
    case: ModerationCase;
  } | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newContent, setNewContent] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: nextItem, isLoading } = useQuery<ContentItem>({
    queryKey: ["/api/content/next"],
    enabled: !activeCase,
  });

  const uploadMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", "/api/content", {
        content,
        type: "text",
        priority: 1,
        metadata: {
          originalMetadata: {},
        },
      });
    },
    onSuccess: () => {
      setNewContent("");
      setShowUploadForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/content/next"] });
      toast({
        title: "Content uploaded",
        description: "Your content has been uploaded and will be analyzed by AI.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload content. Please try again.",
      });
    },
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

      return { content, case: case_ };
    },
    onSuccess: (data) => {
      setActiveCase({
        content: data.content,
        case: data.case,
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

  const handleOpenModeration = async (item: ContentItem) => {
    assignMutation.mutate(item.id);
  };

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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Moderation Queue</h1>
        <Button onClick={() => setShowUploadForm(!showUploadForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Test Content
        </Button>
      </div>

      {showUploadForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Test Content</CardTitle>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                uploadMutation.mutate(newContent);
              }}
              className="space-y-4"
            >
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Enter content to test AI moderation..."
                className="min-h-[100px]"
              />
              <Button 
                type="submit" 
                disabled={uploadMutation.isPending || !newContent.trim()}
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Content"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add the content queue with search/sort/pagination */}
      <ContentQueue onOpenModeration={handleOpenModeration} />

      {/* Show the next item to moderate */}
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