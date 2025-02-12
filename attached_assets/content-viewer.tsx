import { useState, useRef, useEffect } from "react";
import { type Content } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { type ContentRegion } from "@/lib/types";
import { DownloadCloud, ThumbsUp, ThumbsDown, Search, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { AlertTriangle, ThumbsUpIcon, ThumbsDownIcon, Check, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type VideoTimestamp = {
  time: number;
  confidence: Record<string, number>;
};

export default function ContentViewer({ content: initialContent }: { content: Content }) {
  const [location, navigate] = useLocation();
  const [comments, setComments] = useState("");
  const [blurred, setBlurred] = useState(true);
  const [sensitivity, setSensitivity] = useState([50]);
  const [showHighlights, setShowHighlights] = useState(true);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [selectedTimestamp, setSelectedTimestamp] = useState<VideoTimestamp | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [content, setContent] = useState(initialContent);
  const queryClient = useQueryClient();

  const moderationMutation = useMutation({
    mutationFn: async ({ status, aiDecision }: { status: Content["status"]; aiDecision: string }) => {
      const response = await fetch(`/api/content/${content.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, comments, aiDecision }),
      });

      if (!response.ok) {
        throw new Error('Failed to update content status');
      }

      return response.json();
    },
    onSuccess: (updatedContent) => {
      setContent(updatedContent);
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      navigate("/");
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ contentId, isCorrect, notes }: { contentId: number, isCorrect: boolean, notes?: string }) => {
      const response = await fetch(`/api/content/${contentId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isCorrect, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      return response.json();
    },
    onSuccess: (updatedContent) => {
      setContent(updatedContent);
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Thank you for your feedback! This helps improve our AI model.",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Content deleted successfully",
        duration: 3000,
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete content",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const getVideoTimestamps = (): VideoTimestamp[] => {
    try {
      const aiOutput = JSON.parse(content.aiOutput || "[]");
      console.log("Parsed video timestamps:", aiOutput);
      return aiOutput.map((output: any) => ({
        time: output.time,
        confidence: output.confidence || {},
      }));
    } catch (e) {
      console.error("Error parsing video timestamps:", e);
      console.error("Raw aiOutput:", content.aiOutput);
      return [];
    }
  };

  const getVideoThumbnails = (): string[] => {
    try {
      const aiOutput = JSON.parse(content.aiOutput || "[]");
      console.log("Processing video thumbnails from aiOutput:", aiOutput);

      return aiOutput.map((output: any) => {
        if (output.thumbnail) {
          console.log("Found thumbnail URL:", output.thumbnail);
          return output.thumbnail;
        }
        return null;
      }).filter(Boolean);
    } catch (e) {
      console.error("Error parsing video thumbnails:", e);
      console.error("Raw aiOutput:", content.aiOutput);
      return [];
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleThumbnailClick = (timestamp: VideoTimestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp.time;
      setSelectedTimestamp(timestamp);
      setCurrentVideoTime(timestamp.time);
    }
  };

  const renderVideo = () => {
    const timestamps = getVideoTimestamps();
    const thumbnails = getVideoThumbnails();
    const confidence = selectedTimestamp?.confidence || getAiConfidence();

    console.log("Rendering video with:", {
      timestamps,
      thumbnails,
      confidence
    });

    return (
      <div className="space-y-4">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <video
            ref={videoRef}
            src={content.url}
            controls
            className="w-full h-full"
            style={{
              filter: blurred ? `blur(${getBlurAmount()}px)` : 'none'
            }}
            onTimeUpdate={(e) => setCurrentVideoTime(e.currentTarget.currentTime)}
          />
        </div>

        {timestamps.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Video Timeline Analysis</h3>
            <div className="relative">
              <Carousel
                className="w-full"
                opts={{
                  align: 'start',
                  slidesToScroll: 4
                }}
              >
                <CarouselContent>
                  {timestamps.map((timestamp, index) => {
                    const hasWarnings = Object.values(timestamp.confidence).some(score => score > 0.01);
                    const thumbnailUrl = thumbnails[index];

                    console.log(`Rendering thumbnail ${index}:`, {
                      timestamp,
                      thumbnailUrl,
                      hasWarnings
                    });

                    return (
                      <CarouselItem key={index} className="basis-1/4 md:basis-1/6 lg:basis-1/8">
                        <div
                          className={cn(
                            "cursor-pointer rounded-md overflow-hidden border-2",
                            selectedTimestamp?.time === timestamp.time ? "border-primary" : "border-transparent",
                            hasWarnings ? "border-red-500" : "border-transparent"
                          )}
                          onClick={() => handleThumbnailClick(timestamp)}
                        >
                          <div className="relative aspect-video bg-muted">
                            {thumbnailUrl ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={thumbnailUrl}
                                  alt={`Thumbnail at ${formatTime(timestamp.time)}`}
                                  className="w-full h-full object-cover"
                                  style={{
                                    filter: blurred ? `blur(${getBlurAmount()}px)` : 'none'
                                  }}
                                  onError={(e) => {
                                    console.error(`Error loading thumbnail ${index}:`, thumbnailUrl);
                                    e.currentTarget.style.display = 'none';
                                    // Add a fallback background with the video frame
                                    if (videoRef.current) {
                                      const time = timestamp.time;
                                      videoRef.current.currentTime = time;
                                      const canvas = document.createElement('canvas');
                                      canvas.width = videoRef.current.videoWidth;
                                      canvas.height = videoRef.current.videoHeight;
                                      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
                                      e.currentTarget.src = canvas.toDataURL();
                                      e.currentTarget.style.display = 'block';
                                    }
                                  }}
                                />
                                {hasWarnings && (
                                  <div className="absolute top-1 right-1">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">No preview</span>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-[10px]">
                              <Clock className="inline-block w-2 h-2 mr-0.5" />
                              {formatTime(timestamp.time)}
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          </div>
        )}

        {showHighlights && confidence && Object.keys(confidence).length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-lg font-semibold">
              Content Warnings
              {selectedTimestamp && (
                <span className="text-sm text-muted-foreground ml-2">
                  at {formatTime(selectedTimestamp.time)}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(confidence)
                .filter(([_, score]) => score > 0.01)
                .sort(([_, a], [__, b]) => b - a)
                .map(([type, score]) => (
                  <div
                    key={type}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm text-white transition-colors ${getConfidenceColor(score)}`}
                  >
                    <span className="capitalize mr-2">{type.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-bold">
                      {formatConfidence(score)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getAiConfidence = (): Record<string, number> => {
    try {
      let rawConfidence: Record<string, number>;
      try {
        rawConfidence = JSON.parse(content.aiConfidence || "{}");
      } catch {
        rawConfidence = {};
      }
      console.log("Raw AI confidence scores:", rawConfidence);

      const significantScores = Object.entries(rawConfidence)
        .reduce((acc, [key, value]) => ({
          ...acc,
          [key.replace(/_/g, ' ')]: value
        }), {});

      console.log("Filtered confidence scores:", significantScores);
      return significantScores;
    } catch (e) {
      console.error("Error parsing AI confidence:", e);
      return {};
    }
  };

  const getOffensiveRegions = (): ContentRegion[] => {
    try {
      return JSON.parse(content.offensiveRegions || "[]");
    } catch (e) {
      console.error("Error parsing offensive regions:", e);
      return [];
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    const reportData = {
      content: {
        id: content.id,
        title: content.title,
        type: content.type,
        url: content.url,
        status: content.status,
        queuedAt: content.queuedAt,
      },
      moderation: {
        regions: getOffensiveRegions(),
        confidence: getAiConfidence(),
        aiDecision: content.aiDecision,
        humanDecision: content.humanDecision,
      },
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `content-report-${content.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getBlurAmount = () => {
    if (!blurred) return 0;
    return Math.max(2, Math.round(sensitivity[0] / 5));
  };

  const handleModeration = (status: Content["status"]) => {
    moderationMutation.mutate({
      status,
      aiDecision: content.aiDecision || status,
    });
  };

  const handleAIFeedback = (isCorrect: boolean) => {
    feedbackMutation.mutate({
      contentId: content.id,
      isCorrect,
      notes: comments,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(content.id);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.03) return 'bg-red-500';
    if (score >= 0.01) return 'bg-orange-400';
    return 'bg-gray-200';
  };

  const getConfidenceTextColor = (score: number) => {
    // Always return white text for better contrast
    return 'text-white';
  };

  const formatConfidence = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(content.type === 'image' || content.type === 'video') && (
            <div className="flex items-center space-x-2">
              <Switch
                id="blur"
                checked={blurred}
                onCheckedChange={setBlurred}
              />
              <Label htmlFor="blur">Blur Content</Label>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Switch
              id="highlights"
              checked={showHighlights}
              onCheckedChange={setShowHighlights}
            />
            <Label htmlFor="highlights">Show Content Warnings</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Content
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the content and remove the file from storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <DownloadCloud className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Export as CSV (Coming Soon)
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Export as PDF (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(content.type === 'image' || content.type === 'video') && (
        <div className="space-y-2">
          <Label>Content Sensitivity</Label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Low</span>
            <Slider
              value={sensitivity}
              onValueChange={setSensitivity}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">High</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Adjust slider to control content filtering intensity
          </p>
        </div>
      )}

      {content.type === "image" && (
        <div className="space-y-4">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={content.url}
              alt={content.title}
              className="object-cover w-full h-full transition-all"
              style={{
                filter: blurred ? `blur(${getBlurAmount()}px)` : 'none'
              }}
            />
          </div>

          {showHighlights && (
            <div className="mt-4 space-y-2">
              <h3 className="text-lg font-semibold">Content Warnings</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(getAiConfidence())
                  .sort(([_, a], [__, b]) => b - a)
                  .map(([type, score]) => (
                    <div
                      key={type}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm text-white transition-colors ${getConfidenceColor(score)}`}
                    >
                      <span className="capitalize mr-2">{type.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-bold">
                        {formatConfidence(score)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {content.type === "video" && renderVideo()}
      {content.type === "text" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-card text-card-foreground">
            {content.url && (
              <div className="relative">
                <iframe
                  src={content.url}
                  className="w-full min-h-[400px] border-none"
                  title={content.title}
                />
                {showHighlights && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-lg font-semibold">Content Warnings</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(getAiConfidence())
                        .sort(([_, a], [__, b]) => b - a)
                        .map(([type, score]) => (
                          <div
                            key={type}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm text-white transition-colors ${getConfidenceColor(score)}`}
                          >
                            <span className="capitalize mr-2">{type.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-bold">
                              {formatConfidence(score)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <span className="text-sm font-medium capitalize">{content.status}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground">URL:</span>
          <span className="text-sm font-medium break-all">{content.url}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comments">Moderation Comments</Label>
        <Textarea
          id="comments"
          placeholder="Add any notes or comments about the moderation decision..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="destructive"
          onClick={() => handleModeration("rejected")}
          disabled={moderationMutation.isPending}
        >
          <ThumbsDownIcon className="mr-2 h-4 w-4" />
          Reject Content
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleModeration("flagged")}
          disabled={moderationMutation.isPending}
        >
          <Search className="mr-2 h-4 w-4" />
          Secondary Review
        </Button>
        <Button
          variant="default"
          onClick={() => handleModeration("approved")}
          disabled={moderationMutation.isPending}
        >
          <ThumbsUpIcon className="mr-2 h-4 w-4" />
          Approve Content
        </Button>
      </div>

      {content.aiDecision && !content.feedbackProvided && (
        <div className="mt-8 space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <div className="ml-2">
              Help improve our AI model by providing feedback on its decision
            </div>
          </Alert>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => handleAIFeedback(false)}
              disabled={feedbackMutation.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              AI Was Wrong
            </Button>
            <Button
              variant="default"
              onClick={() => handleAIFeedback(true)}
              disabled={feedbackMutation.isPending}
            >
              <Check className="mr-2 h-4 w-4" />
              AI Was Correct
            </Button>
          </div>
        </div>
      )}

      {content.feedbackProvided && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Thank you for your feedback! It helps improve our AI model.
          </p>
        </div>
      )}
    </div>
  );
}