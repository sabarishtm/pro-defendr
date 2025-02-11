import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QueueItem } from "@/components/moderation/queue-item";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ContentQueue from "@/components/content-queue";
import { UploadForm } from "@/components/upload-form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ContentItem } from "@shared/schema";

export default function Queue() {
  const [, setLocation] = useLocation();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newContent, setNewContent] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: nextItem, isLoading } = useQuery<ContentItem>({
    queryKey: ["/api/content/next"],
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

  const handleOpenModeration = async (item: ContentItem) => {
    if (item.status === "pending") {
      setLocation(`/moderate/${item.id}`);
    } else {
      toast({
        title: "Content Already Reviewed",
        description: `This content has already been ${item.status}.`,
        variant: "default"
      });
    }
  };

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
        <Tabs defaultValue="text">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text Content</TabsTrigger>
            <TabsTrigger value="media">Media Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle>Add Text Content</CardTitle>
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
          </TabsContent>
          <TabsContent value="media">
            <UploadForm />
          </TabsContent>
        </Tabs>
      )}

      <ContentQueue onOpenModeration={handleOpenModeration} />

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : nextItem ? (
        <QueueItem
          item={nextItem}
          onAssign={() => handleOpenModeration(nextItem)}
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