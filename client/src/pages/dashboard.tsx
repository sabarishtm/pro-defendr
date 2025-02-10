import { useQuery } from "@tanstack/react-query";
import SidebarNav from "@/components/sidebar-nav";
import AgentStatus from "@/components/agent-status";
import ContentQueue from "@/components/content-queue";
import CaseDetails from "@/components/case-details";
import PerformanceStats from "@/components/performance-stats";

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ["/api/users/me"],
  });

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b">
          <AgentStatus />
        </header>
        <main className="flex-1 p-6 flex gap-6 overflow-auto">
          <div className="flex-1 flex flex-col gap-6">
            <ContentQueue />
            <PerformanceStats />
          </div>
          <div className="w-[400px]">
            <CaseDetails />
          </div>
        </main>
      </div>
    </div>
  );
}
