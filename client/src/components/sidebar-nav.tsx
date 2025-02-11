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
        "flex flex-col bg-sidebar border-r transition-[width] duration-300 ease-in-out group",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo Area - Fixed height and consistent padding */}
      <div className="h-16 flex items-center px-4 relative border-b">
        <div className="relative w-full h-full flex items-center">
          {/* Expanded logo */}
          <div className={cn(
            "flex items-center gap-2 absolute left-0 transition-all duration-300",
            isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          )}>
            <Shield className="h-8 w-8 text-primary flex-shrink-0" />
            <span className="text-xl font-bold whitespace-nowrap">Defendr</span>
          </div>
          {/* Collapsed logo */}
          <div className={cn(
            "absolute left-0 transition-all duration-300",
            isExpanded ? "opacity-0 scale-75" : "opacity-100 scale-100"
          )}>
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Navigation Area */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => (
            <Button
              key={item.name}
              variant="ghost"
              className={cn(
                "w-full justify-start h-10 transition-all duration-300",
                !isExpanded && "px-3"
              )}
              onClick={() => navigate(`/${item.href}`)}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className={cn(
                "ml-3 transition-all duration-300",
                !isExpanded && "w-0 opacity-0"
              )}>
                {item.name}
              </span>
            </Button>
          ))}
        </nav>
      </ScrollArea>

      {/* User Profile and Logout Area */}
      {user && (
        <div className="border-t">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <div className={cn(
                "flex flex-col transition-all duration-300",
                !isExpanded && "w-0 opacity-0"
              )}>
                <span className="text-sm font-medium truncate">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</span>
              </div>
            </div>
            <Separator className="my-2" />
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-10 transition-all duration-300",
                !isExpanded && "px-3"
              )}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className={cn(
                "ml-3 transition-all duration-300",
                !isExpanded && "w-0 opacity-0"
              )}>
                Logout
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}