import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AgentStatus from "@/components/agent-status";
import ContentQueue from "@/components/content-queue";
import PerformanceStats from "@/components/performance-stats";
import type { ContentItem } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/users/me"],
  });

  const handleOpenModeration = (item: ContentItem) => {
    setLocation(`/moderate/${item.id}`);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-4 border-b">
        <AgentStatus />
      </header>
      <main className="flex-1 p-6 flex gap-6 overflow-auto">
        <div className="flex-1 flex flex-col gap-6">
          <ContentQueue onOpenModeration={handleOpenModeration} />
          <PerformanceStats />
        </div>
      </main>
    </div>
  );
}