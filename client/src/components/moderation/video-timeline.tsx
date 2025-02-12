import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Brain, Video } from "lucide-react";

interface TimelineEntry {
  time: number;
  confidence: Record<string, number>;
}

interface VideoTimelineProps {
  timeline: TimelineEntry[];
  onTimeSelect: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function VideoTimeline({ timeline, onTimeSelect, videoRef }: VideoTimelineProps) {
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  useEffect(() => {
    // Generate thumbnails for each timeline entry
    const generateThumbnail = async (time: number) => {
      if (!videoRef.current || thumbnails[time]) return;

      try {
        // Create a temporary canvas to capture the frame
        const canvas = document.createElement('canvas');
        const video = videoRef.current;

        // Set canvas size to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Store current time
        const currentTime = video.currentTime;

        // Seek to the timestamp
        video.currentTime = time;

        // Wait for seeked event
        await new Promise<void>((resolve) => {
          const handleSeeked = () => {
            video.removeEventListener('seeked', handleSeeked);
            resolve();
          };
          video.addEventListener('seeked', handleSeeked);
        });

        // Draw the video frame to canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Convert canvas to data URL
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          setThumbnails(prev => ({ ...prev, [time]: thumbnail }));
        }

        // Restore original playback position
        video.currentTime = currentTime;
      } catch (error) {
        console.error('Error generating thumbnail:', error);
      }
    };

    // Only generate thumbnails when video is loaded
    if (videoRef.current && videoRef.current.readyState >= 2) {
      timeline.forEach(entry => generateThumbnail(entry.time));
    } else {
      // Wait for video to load
      const handleLoadedData = () => {
        timeline.forEach(entry => generateThumbnail(entry.time));
      };
      videoRef.current?.addEventListener('loadeddata', handleLoadedData);
      return () => videoRef.current?.removeEventListener('loadeddata', handleLoadedData);
    }
  }, [timeline, videoRef.current?.readyState]);

  const handleTimeSelect = (time: number) => {
    setSelectedTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      onTimeSelect(time);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSignificantWarnings = (confidence: Record<string, number>) => {
    return Object.entries(confidence)
      .filter(([_, score]) => score > 0.3) // Only show warnings with confidence > 30%
      .sort((a, b) => b[1] - a[1]); // Sort by confidence score
  };

  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Brain className="h-4 w-4" />
        <h3 className="text-sm font-medium">Content Timeline</h3>
      </div>

      <Carousel className="w-full">
        <CarouselContent>
          {timeline.map((entry, index) => (
            <CarouselItem key={index} className="basis-1/4">
              <Card 
                className={`cursor-pointer transition-all ${selectedTime === entry.time ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleTimeSelect(entry.time)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                    {thumbnails[entry.time] ? (
                      <img
                        src={thumbnails[entry.time]}
                        alt={`Thumbnail at ${formatTime(entry.time)}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <Video className="h-8 w-8 text-muted-foreground animate-pulse" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs font-medium">
                      {formatTime(entry.time)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {getSignificantWarnings(entry.confidence).map(([warning, score], idx) => (
                      <Badge 
                        key={idx}
                        variant={score > 0.7 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {warning} ({Math.round(score * 100)}%)
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}