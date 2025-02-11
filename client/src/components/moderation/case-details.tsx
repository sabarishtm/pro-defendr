import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { ThumbsUp, ThumbsDown, AlertTriangle, Brain, ImageIcon, FileText, Video } from "lucide-react";
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
  console.log("CaseDetails received contentItem:", contentItem);

  const [notes, setNotes] = useState(moderationCase?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaError, setMediaError] = useState(false);
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

  // Function to render content based on type
  const renderContent = () => {
    console.log("Rendering content with type:", contentItem.type);
    console.log("Content value:", contentItem.content);

    const type = contentItem.type?.toLowerCase() || 'text';
    console.log("Normalized type:", type);

    switch (type) {
      case "text":
        console.log("Rendering text content");
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Text Content</span>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="whitespace-pre-wrap text-base">
                {contentItem.content}
              </p>
            </div>
          </div>
        );

      case "image":
        console.log("Rendering image content");
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Image Content</span>
            </div>
            {mediaError ? (
              <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load image</p>
                </div>
              </div>
            ) : (
              <img 
                src={contentItem.content} 
                alt="Content for review"
                className="w-full max-h-96 object-contain rounded-lg"
                onError={() => setMediaError(true)}
              />
            )}
          </div>
        );

      case "video":
        console.log("Rendering video content");
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Video Content</span>
            </div>
            {mediaError ? (
              <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
                <div className="text-center">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load video</p>
                </div>
              </div>
            ) : (
              <video
                src={contentItem.content}
                controls
                className="w-full max-h-96 rounded-lg"
                onError={() => setMediaError(true)}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        );

      default:
        console.log("Rendering unknown content type");
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Unknown Content Type</span>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Content type not supported: {type}
              </p>
              <p className="mt-2 text-base whitespace-pre-wrap">
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
      <CardContent className="space-y-6">
        {contentItem.priority > 2 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This content has been flagged as high priority
            </AlertDescription>
          </Alert>
        )}

        {/* AI Analysis Section */}
        {contentItem.metadata?.aiAnalysis && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Analysis</h3>
            </div>

            <div className="grid gap-4">
              {contentItem.metadata.aiAnalysis.classification && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Suggested Action:</span>
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

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Confidence Score</span>
                      <span>
                        {Math.round(contentItem.metadata.aiAnalysis.classification.confidence * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={contentItem.metadata.aiAnalysis.classification.confidence * 100}
                    />
                  </div>
                </>
              )}

              {contentItem.metadata.aiAnalysis.contentFlags?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Content Flags:</span>
                  <div className="space-y-1">
                    {contentItem.metadata.aiAnalysis.contentFlags.map((flag, index) => (
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

        {/* Content Display */}
        <div className="space-y-4">
          {renderContent()}

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