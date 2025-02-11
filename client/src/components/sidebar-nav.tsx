import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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

  // Get current user data
  const { data: user } = useQuery({
    queryKey: ["/api/users/me"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  // Generate user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

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
        "p-6 transition-all duration-300 flex items-center relative h-[72px]",
        !isExpanded && "p-3"
      )}>
        <div className="relative w-full h-full flex items-center">
          <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0 scale-75"
          )}>
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Defendr</span>
          </div>
          <div className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 transition-all duration-300",
            isExpanded ? "opacity-0" : "opacity-100"
          )}>
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
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

      {user && (
        <div className={cn(
          "p-4 border-t",
          !isExpanded && "p-2"
        )}>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
              {getInitials(user.name)}
            </div>
            <div className={cn(
              "flex flex-col transition-all duration-300 overflow-hidden",
              !isExpanded && "w-0"
            )}>
              <span className="text-sm font-medium truncate">{user.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</span>
            </div>
          </div>
          <Separator className="my-2" />
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
      )}
    </div>
  );
}