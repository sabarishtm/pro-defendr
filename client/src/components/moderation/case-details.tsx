import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { ThumbsUp, ThumbsDown, AlertTriangle, Brain, ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CaseDetailsProps {
  contentItem: ContentItem;
  moderationCase: ModerationCase | undefined;
  onComplete: () => void;
}

export function CaseDetails({ 
  contentItem, 
  moderationCase,
  onComplete 
}: CaseDetailsProps) {
  const [notes, setNotes] = useState(moderationCase?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  async function handleDecision(decision: "approve" | "reject") {
    try {
      setIsSubmitting(true);

      if (moderationCase) {
        await apiRequest("PATCH", `/api/cases/${moderationCase.id}`, {
          decision,
          notes,
          status: "closed"
        });
      }

      await apiRequest("PATCH", `/api/content/${contentItem.id}`, {
        status: decision === "approve" ? "approved" : "rejected"
      });

      toast({
        title: "Decision recorded",
        description: `Content has been ${decision === "approve" ? "approved" : "rejected"}.`
      });

      onComplete();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record decision. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Safely access AI analysis data with null checks
  const aiAnalysis = contentItem.metadata?.aiAnalysis;

  // Function to get image URL based on content type
  const getImageContent = () => {
    const content = contentItem.content;
    if (!content) return null;

    // Check if it's already a valid URL
    try {
      new URL(content);
      return content;
    } catch {
      // If not a URL, assume it's base64 data
      if (content.startsWith('data:image')) {
        return content;
      }
      // If it's neither, return null
      return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {contentItem.priority > 2 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This content has been flagged as high priority
            </AlertDescription>
          </Alert>
        )}

        {/* Only show AI analysis if it exists */}
        {aiAnalysis && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Analysis</h3>
            </div>

            <div className="grid gap-4">
              {aiAnalysis.classification && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Suggested Action:</span>
                    <Badge variant={
                      aiAnalysis.classification.suggestedAction === "approve" 
                        ? "default"  
                        : aiAnalysis.classification.suggestedAction === "reject"
                        ? "destructive"
                        : "secondary"  
                    }>
                      {aiAnalysis.classification.suggestedAction}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Confidence Score</span>
                      <span>{Math.round(aiAnalysis.classification.confidence * 100)}%</span>
                    </div>
                    <Progress value={aiAnalysis.classification.confidence * 100} />
                  </div>
                </>
              )}

              {aiAnalysis.contentFlags && aiAnalysis.contentFlags.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Content Flags:</span>
                  <div className="space-y-1">
                    {aiAnalysis.contentFlags.map((flag, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{flag.type}</span>
                        <Badge variant="outline">
                          Severity: {flag.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {contentItem.type === "text" ? (
            <div className="p-4 bg-muted rounded-lg">
              <p>{contentItem.content}</p>
            </div>
          ) : contentItem.type === "image" ? (
            <div className="relative">
              {imageError ? (
                <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Failed to load image</p>
                  </div>
                </div>
              ) : (
                <img 
                  src={getImageContent() || ''}
                  alt="Content for review"
                  className="w-full max-h-96 object-contain rounded-lg"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Unsupported content type: {contentItem.type}</p>
            </div>
          )}

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about your decision..."
            className="min-h-[100px]"
          />

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleDecision("approve")}
              disabled={isSubmitting}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleDecision("reject")}
              disabled={isSubmitting}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}