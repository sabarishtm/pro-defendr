import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ContentItem } from "@shared/schema";
import { Eye, EyeOff, FileText, Image as ImageIcon, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { VideoTimeline } from "./video-timeline";

interface CaseDetailsProps {
  contentItem: ContentItem;
  moderationCase: any;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleSubmit = async (decision: string) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await apiRequest("PATCH", `/api/cases/${moderationCase.id}/decision`, {
        decision,
        notes,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Decision Recorded",
        description: "Your moderation decision has been saved.",
      });
      onComplete();
      setLocation("/queue");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record decision",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBlurStyle = () => {
    if (!isBlurred) return {};
    return {
      filter: `blur(${blurLevel / 10}px)`,
      transition: "filter 0.3s ease-in-out",
    };
  };

  const handleTimelineSelect = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
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
            <div className="p-4 bg-muted rounded-lg">
              <p className="whitespace-pre-wrap">{contentItem.content}</p>
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
                  >
                    Your browser does not support the video tag.
                  </video>
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

                {contentItem.metadata?.aiAnalysis?.timeline && (
                  <VideoTimeline
                    timeline={contentItem.metadata.aiAnalysis.timeline}
                    onTimeSelect={handleTimelineSelect}
                    videoRef={videoRef}
                  />
                )}
              </>
            )}
          </div>
        );

      default:
        return (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Unsupported content type: {type}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {renderContent()}

          <Card>
            <CardContent className="pt-6 space-y-4">
              <Textarea
                placeholder="Add notes about your moderation decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleSubmit("reject")}
                  disabled={isSubmitting}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleSubmit("approve")}
                  disabled={isSubmitting}
                >
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {contentItem.metadata?.aiAnalysis && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">AI Analysis</h3>
                  {contentItem.metadata.aiAnalysis.classification && (
                    <div className="space-y-4">
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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="font-medium">
                            {Math.round(contentItem.metadata.aiAnalysis.classification.confidence * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={contentItem.metadata.aiAnalysis.classification.confidence * 100}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {contentItem.metadata.aiAnalysis.detectedViolations && (
                  <div>
                    <h4 className="font-medium mb-2">Detected Violations</h4>
                    <div className="space-y-1">
                      {Object.entries(contentItem.metadata.aiAnalysis.detectedViolations)
                        .sort(([, a], [, b]) => b - a)
                        .map(([violation, confidence]) => (
                          <div
                            key={violation}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground capitalize">
                              {violation.replace(/_/g, " ")}:
                            </span>
                            <Badge variant={confidence > 0.7 ? "destructive" : "secondary"}>
                              {Math.round(confidence * 100)}%
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}