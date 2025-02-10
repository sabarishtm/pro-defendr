import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContentItem } from "@shared/schema";
import { AlertTriangle } from "lucide-react";

interface QueueItemProps {
  item: ContentItem;
  onAssign: () => void;
}

export function QueueItem({ item, onAssign }: QueueItemProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {item.type === "text" ? "Text Content" : "Image Content"}
        </CardTitle>
        <Badge variant={item.priority > 2 ? "destructive" : "secondary"}>
          Priority {item.priority}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {item.type === "text" ? (
            <p className="text-sm text-muted-foreground">{item.content}</p>
          ) : (
            <img 
              src={item.content} 
              alt="Content to moderate"
              className="w-full h-40 object-cover rounded-md"
            />
          )}
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Source: {item.metadata.source}
              </p>
            </div>
            {item.priority > 2 && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <Button onClick={onAssign}>
              Review Content
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
