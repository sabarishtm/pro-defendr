import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { type Content } from "@shared/schema";
import ContentViewer from "@/components/content-viewer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContentView() {
  const { id } = useParams();
  const { data: content, isLoading } = useQuery<Content>({
    queryKey: [`/api/content/${id}`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <Card className="p-4">
          <Skeleton className="h-[400px] w-full" />
        </Card>
      </div>
    );
  }

  if (!content) {
    return <div>Content not found</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <Card className="p-4">
        <ContentViewer content={content} />
      </Card>
    </div>
  );
}