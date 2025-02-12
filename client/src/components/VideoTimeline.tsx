import { useRef } from "react";
import { Card } from "./ui/card";
import { VideoOutput } from "@shared/schema";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface VideoTimelineProps {
  timeline: VideoOutput[];
  videoRef: React.RefObject<HTMLVideoElement>;
  onTimeSelect: (time: number) => void;
}

export const VideoTimeline = ({ timeline, videoRef, onTimeSelect }: VideoTimelineProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 200;
    const container = scrollContainerRef.current;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

  const captureVideoFrame = async (time: number) => {
    if (!videoRef.current) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Save current time
    const currentTime = video.currentTime;

    // Set video to desired time
    video.currentTime = time;

    // Wait for video to update to new time
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    // Capture frame
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Reset video to original time
    video.currentTime = currentTime;

    return canvas.toDataURL('image/jpeg');
  };

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-lg font-semibold mb-2">Video Timeline Analysis</h3>
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto px-8 py-2 hide-scrollbar"
          style={{ scrollbarWidth: 'none' }}
        >
          {timeline.map((point, index) => {
            const flagTypes = Object.keys(point.confidence);
            const maxConfidence = Math.max(...Object.values(point.confidence));
            const severity = maxConfidence > 0.8 ? "high" : maxConfidence > 0.4 ? "medium" : "low";

            return (
              <motion.div
                key={index}
                className="flex-shrink-0 cursor-pointer"
                whileHover={{ scale: 1.05 }}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = point.time;
                    onTimeSelect(point.time);
                  }
                }}
              >
                <div className="relative">
                  <div 
                    className={`
                      w-32 h-24 bg-muted rounded-md flex items-center justify-center
                      ${severity === "high" ? "border-2 border-red-500" :
                        severity === "medium" ? "border-2 border-yellow-500" :
                        "border border-border"}
                    `}
                  >
                    <video
                      className="w-full h-full object-cover rounded-md"
                      src={videoRef.current?.src}
                      preload="metadata"
                    >
                      <source src={videoRef.current?.src} type="video/mp4" />
                    </video>
                    <span className="absolute bottom-1 right-1 text-xs bg-black/70 text-white px-1 rounded">
                      {Math.floor(point.time)}s
                    </span>
                  </div>
                  {flagTypes.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-1 text-xs truncate rounded-b-md">
                      {flagTypes.join(", ")}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};