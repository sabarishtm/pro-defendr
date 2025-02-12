import { useRef, useState } from "react";
import { Card } from "./ui/card";
import { ContentItem, VideoOutput } from "@shared/schema";
import { VideoTimeline } from "./VideoTimeline";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle } from "lucide-react";

interface ContentViewerProps {
  content: ContentItem;
}

export const ContentViewer = ({ content }: ContentViewerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);

  const renderContent = () => {
    if (content.type === "text") {
      return <p className="whitespace-pre-wrap">{content.content}</p>;
    }

    if (content.type === "image") {
      return (
        <img 
          src={content.content} 
          alt="Content for review" 
          className="max-w-full h-auto rounded-md"
        />
      );
    }

    if (content.type === "video") {
      return (
        <div>
          <video
            ref={videoRef}
            src={content.content}
            controls
            className="max-w-full rounded-md"
          />
          {content.metadata.aiAnalysis?.timeline && (
            <>
              <VideoTimeline
                timeline={content.metadata.aiAnalysis.timeline}
                videoRef={videoRef}
                onTimeSelect={setSelectedTime}
              />
              {selectedTime !== null && (
                <TimelineWarnings
                  timeline={content.metadata.aiAnalysis.timeline}
                  selectedTime={selectedTime}
                />
              )}
            </>
          )}
        </div>
      );
    }

    return <p>Unsupported content type</p>;
  };

  const filename = typeof content.metadata.originalMetadata === 'object' && 
    content.metadata.originalMetadata !== null && 
    'filename' in content.metadata.originalMetadata
    ? String(content.metadata.originalMetadata.filename)
    : null;

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {filename && (
          <h2 className="text-xl font-semibold">
            {filename}
          </h2>
        )}
        {renderContent()}
      </div>
    </Card>
  );
};

interface TimelineWarningsProps {
  timeline: VideoOutput[];
  selectedTime: number;
}

const TimelineWarnings = ({ timeline, selectedTime }: TimelineWarningsProps) => {
  const timePoint = timeline?.find(point => Math.abs(point.time - selectedTime) < 0.1);
  if (!timePoint || Object.keys(timePoint.confidence).length === 0) return null;

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold">Content warnings at {selectedTime.toFixed(1)}s:</div>
        <ul className="list-disc pl-4 mt-2">
          {Object.entries(timePoint.confidence).map(([type, confidence]) => (
            <li key={type}>
              {type}: {(Number(confidence) * 100).toFixed(1)}% confidence
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};