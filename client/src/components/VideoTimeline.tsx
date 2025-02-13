import { useRef, useEffect } from "react";
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

  useEffect(() => {
    console.log("VideoTimeline mounted with:", {
      hasTimeline: Boolean(timeline),
      timelineLength: timeline?.length,
      hasVideoRef: Boolean(videoRef.current),
      videoSrc: videoRef.current?.src
    });
  }, [timeline, videoRef]);

  // Return early if no timeline data
  if (!timeline?.length) {
    console.log("No timeline data available");
    return null;
  }

  console.log("Rendering timeline with", timeline.length, "points");

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-lg font-semibold mb-2">Video Timeline Analysis</h3>
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({
                left: -200,
                behavior: "smooth"
              });
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto px-8 py-2 scrollbar-hide relative"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {timeline.map((point, index) => {
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
                      w-32 h-24 bg-muted rounded-md flex items-center justify-center overflow-hidden
                      ${severity === "high" ? "border-2 border-red-500" :
                        severity === "medium" ? "border-2 border-yellow-500" :
                        "border border-border"}
                    `}
                  >
                    {point.thumbnail && (
                      <img 
                        src={point.thumbnail}
                        alt={`Timeline thumbnail at ${point.time}s`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("Failed to load thumbnail:", point.thumbnail);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="absolute bottom-1 right-1 text-xs bg-black/70 text-white px-1 rounded">
                      {Math.floor(point.time)}s
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({
                left: 200,
                behavior: "smooth"
              });
            }
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};