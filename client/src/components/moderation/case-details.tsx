import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { ContentItem, ModerationCase } from "@shared/schema";
import { ThumbsUp, ThumbsDown, AlertTriangle, Brain, ImageIcon, FileText, Video, X, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { VideoTimeline } from "@/components/VideoTimeline";

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
  const [blurLevel, setBlurLevel] = useState(75);
  const [isBlurred, setIsBlurred] = useState(true);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  async function handleDecision(decision: "approve" | "reject" | "review") {
    try {
      setIsSubmitting(true);

      await apiRequest("PATCH", "/api/cases/decision", {
        contentId: contentItem.id,
        decision,
        notes
      });

      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content", contentItem.id] });

      toast({
        title: "Decision recorded",
        description: `Content has been ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "sent for secondary review"}.`
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

  const getBlurStyle = () => {
    if (!isBlurred) return {};
    return {
      filter: `blur(${blurLevel / 10}px)`,
      transition: 'filter 0.3s ease-in-out'
    };
  };

  const renderContent = () => {
    switch (contentItem.type?.toLowerCase() || 'text') {
      case "text":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-base font-medium">Text Content</span>
            </div>
            <div className="p-6 bg-background border rounded-lg shadow-sm">
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
              <>
                <div className="bg-background border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                  <img
                    src={contentItem.content}
                    alt="Content for review"
                    className="w-full h-[calc(100vh-400px)] min-h-[400px] object-contain"
                    style={getBlurStyle()}
                    onError={() => setMediaError(true)}
                  />
                </div>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isBlurred}
                        onCheckedChange={setIsBlurred}
                        aria-label="Toggle blur"
                      />
                      <span className="text-sm font-medium">
                        {isBlurred ? (
                          <div className="flex items-center gap-1">
                            <EyeOff className="h-4 w-4" />
                            <span>Blur enabled</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>Blur disabled</span>
                          </div>
                        )}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Blur level: {blurLevel}%
                    </span>
                  </div>
                  <Slider
                    value={[blurLevel]}
                    onValueChange={([value]) => setBlurLevel(value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                    disabled={!isBlurred}
                  />
                </div>
              </>
            )}
          </div>
        );

      case "video":
        console.log("Rendering video content:", {
          hasMetadata: !!contentItem.metadata,
          hasAiAnalysis: !!contentItem.metadata.aiAnalysis,
          hasTimeline: !!contentItem.metadata.aiAnalysis?.timeline,
          timelineLength: contentItem.metadata.aiAnalysis?.timeline?.length
        });
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
              <>
                <div className="bg-background border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                  <video
                    ref={videoRef}
                    src={contentItem.content}
                    controls
                    className="w-full h-[calc(100vh-400px)] min-h-[400px] object-contain"
                    style={getBlurStyle()}
                    onError={() => setMediaError(true)}
                    onLoadedMetadata={() => console.log("Video loaded:", {
                      duration: videoRef.current?.duration,
                      src: videoRef.current?.src
                    })}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {contentItem.metadata.aiAnalysis?.timeline && (
                  <>
                    <VideoTimeline
                      timeline={contentItem.metadata.aiAnalysis.timeline}
                      videoRef={videoRef}
                      onTimeSelect={(time) => {
                        console.log("Time selected:", time);
                        setSelectedTime(time);
                      }}
                    />
                    {selectedTime !== null && contentItem.metadata.aiAnalysis?.timeline && (
                      <TimelineAlert
                        timeline={contentItem.metadata.aiAnalysis.timeline}
                        selectedTime={selectedTime}
                      />
                    )}
                  </>
                )}

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isBlurred}
                        onCheckedChange={setIsBlurred}
                        aria-label="Toggle blur"
                      />
                      <span className="text-sm font-medium">
                        {isBlurred ? (
                          <div className="flex items-center gap-1">
                            <EyeOff className="h-4 w-4" />
                            <span>Blur enabled</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>Blur disabled</span>
                          </div>
                        )}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Blur level: {blurLevel}%
                    </span>
                  </div>
                  <Slider
                    value={[blurLevel]}
                    onValueChange={([value]) => setBlurLevel(value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                    disabled={!isBlurred}
                  />
                </div>
              </>
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
            <div className="p-6 bg-background border rounded-lg shadow-sm">
              <p className="text-sm text-muted-foreground mb-2">
                Content type not supported: {contentItem.type}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Review</h1>
          <p className="text-sm text-muted-foreground">ID: {contentItem.id}</p>
        </div>
        <Button variant="outline" onClick={handleCancel}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-8">
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

              <div className="grid gap-4">
                {contentItem.metadata.aiAnalysis.contentFlags?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Content Warnings</h3>
                    <div className="flex flex-wrap gap-2">
                      {contentItem.metadata.aiAnalysis.contentFlags.map((flag, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {flag.type} (Severity: {flag.severity})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

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

            <div className="flex justify-end gap-3">
              <Button
                size="lg"
                variant="destructive"
                onClick={() => handleDecision("reject")}
                disabled={isSubmitting}
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                Reject Content
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => handleDecision("review")}
                disabled={isSubmitting}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Secondary Review
              </Button>
              <Button
                size="lg"
                variant="default"
                onClick={() => handleDecision("approve")}
                disabled={isSubmitting}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                Approve Content
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TimelineAlertProps {
  timeline: ContentItem["metadata"]["aiAnalysis"]["timeline"];
  selectedTime: number;
}

function TimelineAlert({ timeline, selectedTime }: TimelineAlertProps) {
  const timePoint = timeline?.find(t => Math.abs(t.time - selectedTime) < 0.1);
  if (!timePoint || Object.keys(timePoint.confidence).length === 0) return null;

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold">Content warnings at {selectedTime.toFixed(1)}s:</div>
        <ul className="list-disc pl-4 mt-2">
          {Object.entries(timePoint.confidence).map(([type, confidence]) => (
            <li key={type}>
              {type}: {(confidence * 100).toFixed(1)}% confidence
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}