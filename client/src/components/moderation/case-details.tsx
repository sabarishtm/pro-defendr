import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { ThumbsUp, ThumbsDown, AlertTriangle, Brain, ImageIcon, FileText, Video, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";

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
  const [mediaError, setMediaError] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  async function handleDecision(decision: "approve" | "reject") {
    try {
      setIsSubmitting(true);
      console.log("Recording decision:", { contentId: contentItem.id, decision, notes });

      // First create/update the case with the decision
      await apiRequest("PATCH", "/api/cases/decision", {
        contentId: contentItem.id,
        decision,
        notes
      });

      toast({
        title: "Decision recorded",
        description: `Content has been ${decision === "approve" ? "approved" : "rejected"}.`
      });

      setLocation("/dashboard");
    } catch (error) {
      console.error("Decision error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record decision. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCancel = () => {
    setLocation("/dashboard");
  };

  const renderContent = () => {
    const type = contentItem.type?.toLowerCase() || 'text';

    switch (type) {
      case "text":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-base font-medium">Text Content</span>
            </div>
            <div className="p-6 bg-card border rounded-lg shadow-sm">
              <p className="whitespace-pre-wrap text-lg leading-relaxed">
                {contentItem.content}
              </p>
            </div>
          </div>
        );

      case "image":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-base font-medium">Image Content</span>
            </div>
            {mediaError ? (
              <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load image</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-card border rounded-lg shadow-sm">
                <img 
                  src={contentItem.content} 
                  alt="Content for review"
                  className="w-full max-h-[400px] object-contain rounded-md"
                  onError={() => setMediaError(true)}
                />
              </div>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-muted-foreground" />
              <span className="text-base font-medium">Video Content</span>
            </div>
            {mediaError ? (
              <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                <div className="text-center">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load video</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-card border rounded-lg shadow-sm">
                <video
                  src={contentItem.content}
                  controls
                  className="w-full max-h-[400px] rounded-md"
                  onError={() => setMediaError(true)}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <span className="text-base font-medium">Unknown Content Type</span>
            </div>
            <div className="p-6 bg-card border rounded-lg shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">
                Content type not supported: {type}
              </p>
              <p className="text-lg whitespace-pre-wrap">
                {contentItem.content}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {contentItem.priority > 2 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This content has been flagged as high priority
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {renderContent()}
        </div>

        {contentItem.metadata?.aiAnalysis && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Brain className="h-4 w-4" />
              <h3 className="text-sm font-medium">AI Analysis</h3>
            </div>

            <div className="grid gap-3">
              {contentItem.metadata.aiAnalysis.classification && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Suggested Action:</span>
                    <Badge variant={
                      contentItem.metadata.aiAnalysis.classification.suggestedAction === "approve" 
                        ? "default"  
                        : contentItem.metadata.aiAnalysis.classification.suggestedAction === "reject"
                        ? "destructive"
                        : "secondary"  
                    }>
                      {contentItem.metadata.aiAnalysis.classification.suggestedAction}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="text-muted-foreground">
                        {Math.round(contentItem.metadata.aiAnalysis.classification.confidence * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={contentItem.metadata.aiAnalysis.classification.confidence * 100}
                      className="h-1.5"
                    />
                  </div>
                </>
              )}

              {contentItem.metadata.aiAnalysis.contentFlags?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Flags:</span>
                  <div className="space-y-1">
                    {contentItem.metadata.aiAnalysis.contentFlags.map((flag, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{flag.type}</span>
                        <Badge variant="outline" className="text-xs">
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

        <div className="space-y-4 pt-4 border-t">
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
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}