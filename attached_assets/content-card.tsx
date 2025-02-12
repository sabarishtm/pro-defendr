import { Link } from "wouter";
import { type Content } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, FileText, Video } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TypeIcon = {
  image: Image,
  video: Video,
  text: FileText,
} as const;

export default function ContentCard({
  content,
  selected = false,
  onSelect,
  selectionMode = false
}: {
  content: Content;
  selected?: boolean;
  onSelect?: (id: number) => void;
  selectionMode?: boolean;
}) {
  const Icon = TypeIcon[content.type];

  const getBlurAmount = (): number => {
    const maxConfidence = Math.max(0, ...Object.values(JSON.parse(content.aiConfidence || "{}")) as number[]);
    if (content.status === "rejected") return 10;
    if (content.status === "flagged") return 7;
    if (content.status === "pending") return 5;
    return maxConfidence > 0.6 ? Math.max(3, Math.round(maxConfidence * 10)) : 0;
  };

  const getTopWarnings = (): string => {
    try {
      const scores = JSON.parse(content.aiConfidence || "{}");
      return Object.entries(scores)
        .filter(([_, score]) => typeof score === 'number' && (content.type === 'text' ? score > 0 : score > 0.01))
        .sort(([_, a], [__, b]) => Number(b) - Number(a))
        .slice(0, 3)
        .map(([type, score]) => {
          const formattedScore = content.type === 'text'
            ? Math.round(Number(score)).toString()
            : `${(Number(score) * 100).toFixed(1)}%`;
          return `${type.replace(/_/g, ' ')}: ${formattedScore}`;
        })
        .join('\n');
    } catch {
      return '';
    }
  };

  const getVideoThumbnail = (): string | null => {
    try {
      const thumbnails = JSON.parse(content.videoThumbnails || "[]");
      return thumbnails[0] || null;
    } catch {
      return null;
    }
  };

  const CardWrapper = selectionMode ? 'div' : Link;
  const cardProps = selectionMode ? {} : { href: `/content/${content.id}` };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      onSelect(content.id);
    }
  };

  const warnings = getTopWarnings();
  const blurAmount = getBlurAmount();

  return (
    <CardWrapper {...cardProps}>
      <Card
        className={`cursor-pointer hover:border-primary transition-colors ${selected ? 'border-primary' : ''}`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <div className="flex items-center gap-2">
              {selectionMode && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onSelect?.(content.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-2"
                />
              )}
              <Icon className="h-4 w-4" />
              <span className="capitalize">{content.type}</span>
            </div>
          </CardTitle>
          <Badge
            variant={
              content.status === "approved"
                ? "outline"
                : content.status === "rejected"
                ? "destructive"
                : "secondary"
            }
          >
            {content.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative aspect-video mb-2 rounded-md overflow-hidden bg-muted group">
                  {content.type === "image" && (
                    <div className="relative w-full h-full">
                      <img
                        src={content.url}
                        alt={content.title}
                        className="w-full h-full object-cover transition-all duration-500 ease-out transform group-hover:scale-110"
                        style={{
                          filter: `blur(${blurAmount}px)`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = `blur(${Math.max(2, blurAmount * 0.4)}px)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = `blur(${blurAmount}px)`;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  )}
                  {content.type === "video" && (
                    <div className="relative w-full h-full">
                      {getVideoThumbnail() ? (
                        <div className="relative w-full h-full">
                          <img
                            src={getVideoThumbnail()!}
                            alt={`Thumbnail for ${content.title}`}
                            className="w-full h-full object-cover transition-all duration-500 ease-out transform group-hover:scale-110"
                            style={{
                              filter: `blur(${blurAmount}px)`
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = `blur(${Math.max(2, blurAmount * 0.4)}px)`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = `blur(${blurAmount}px)`;
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                            <Icon className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <Icon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                  {content.type === "text" && (
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {warnings && (
                <TooltipContent>
                  <p className="whitespace-pre-line">{warnings}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <p className="font-medium truncate">{content.title}</p>
          <p className="text-sm text-muted-foreground">
            Queued {new Date(content.queuedAt || Date.now()).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </CardWrapper>
  );
}