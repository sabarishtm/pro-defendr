import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AgentStatus from "@/components/agent-status";
import ContentQueue from "@/components/content-queue";
import PerformanceStats from "@/components/performance-stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InboxIcon, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { ContentItem } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/users/me"],
  });

  const { data: content = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const stats = content.reduce(
    (acc, item) => {
      acc.total++;
      if (item.status === "pending") acc.pending++;
      if (item.status === "approved") acc.approved++;
      if (item.status === "rejected") acc.rejected++;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );

  const handleOpenModeration = (item: ContentItem) => {
    setLocation(`/moderate/${item.id}`);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-6 border-b">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <AgentStatus />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline space-x-2">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <InboxIcon className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline space-x-2">
              <div className="text-2xl font-bold">{stats.approved}</div>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline space-x-2">
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardContent>
          </Card>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {/* Analytics Section */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Moderation Trends</CardTitle>
                <CardDescription>Content moderation over time</CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceStats />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Content Type Processing</CardTitle>
                <CardDescription>Average processing time by type</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add processing time chart component here */}
              </CardContent>
            </Card>
          </div>

          {/* Content Queue Section */}
          <Card>
            <CardHeader>
              <CardTitle>Content Queue</CardTitle>
              <CardDescription>Recent content requiring moderation</CardDescription>
            </CardHeader>
            <CardContent>
              <ContentQueue onOpenModeration={handleOpenModeration} />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}