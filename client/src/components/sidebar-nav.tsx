import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  InboxIcon,
  BarChart2,
  Users,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "dashboard", icon: LayoutDashboard },
  { name: "Moderation Queue", href: "queue", icon: InboxIcon },
  { name: "Reports", href: "reports", icon: BarChart2 },
  { name: "Team", href: "team", icon: Users },
  { name: "Settings", href: "settings", icon: Settings },
];

export default function SidebarNav() {
  const [, navigate] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar border-r transition-all duration-300 ease-in-out group",
        isExpanded ? "w-64" : "w-[60px]"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={cn(
        "p-6 transition-all duration-300 flex items-center",
        !isExpanded && "p-3"
      )}>
        <img 
          src="./logo.png"
          alt="Sutherland Logo"
          className={cn(
            "h-auto transition-all duration-300",
            isExpanded ? "w-32" : "w-8"
          )}
        />
        <ChevronRight className={cn(
          "h-5 w-5 transition-transform duration-300 ml-auto",
          isExpanded ? "opacity-0 w-0" : "opacity-100",
          "text-sidebar-foreground"
        )} />
      </div>
      <ScrollArea className="flex-1">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => (
            <Button
              key={item.name}
              variant="ghost"
              className={cn(
                "w-full justify-start",
                !isExpanded && "px-3"
              )}
              onClick={() => navigate(`/${item.href}`)}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isExpanded ? "mr-3" : "mr-0"
              )} />
              <span className={cn(
                "transition-all duration-300",
                !isExpanded && "opacity-0 w-0 overflow-hidden"
              )}>
                {item.name}
              </span>
            </Button>
          ))}
        </nav>
      </ScrollArea>
      <div className={cn(
        "p-4 border-t",
        !isExpanded && "p-2"
      )}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start",
            !isExpanded && "px-3"
          )}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className={cn(
            "h-5 w-5",
            isExpanded ? "mr-3" : "mr-0"
          )} />
          <span className={cn(
            "transition-all duration-300",
            !isExpanded && "opacity-0 w-0 overflow-hidden"
          )}>
            Logout
          </span>
        </Button>
      </div>
    </div>
  );
}