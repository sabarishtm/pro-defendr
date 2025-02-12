import { useState } from "react";
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
import { Brain } from "lucide-react";

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
                  <div className="text-sm font-medium">
                    {formatTime(entry.time)}
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
