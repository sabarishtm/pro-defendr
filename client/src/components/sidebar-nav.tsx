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
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { name: "Dashboard", href: "dashboard", icon: LayoutDashboard },
  { name: "Moderation Queue", href: "queue", icon: InboxIcon },
  { name: "Reports", href: "reports", icon: BarChart2 },
  { name: "Team", href: "users", icon: Users },
  { name: "Settings", href: "settings", icon: Settings },
];

export default function SidebarNav() {
  const [, navigate] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar border-r transition-[width] duration-300 ease-in-out",
        isExpanded ? "w-64" : "w-16",
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center border-b relative overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 flex items-center transition-transform duration-300 ease-in-out px-4",
            isExpanded ? "translate-x-0" : "-translate-x-0",
          )}
        >
          <Shield className="h-8 w-8 text-primary flex-shrink-0" />
          <span
            className={cn(
              "ml-3 text-xl font-bold transition-opacity duration-300 ease-in-out whitespace-nowrap",
              isExpanded ? "opacity-100" : "opacity-0",
            )}
          >
            Defendr
          </span>
        </div>
      </div>

      {/* Navigation Area */}
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="space-y-1">
          {navigation.map((item) => (
            <Button
              key={item.name}
              variant="ghost"
              className="w-full justify-start h-10 relative overflow-hidden"
              onClick={() => navigate(`/${item.href}`)}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  "ml-3 transition-all duration-300 ease-in-out absolute left-[2.5rem]",
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-4",
                )}
              >
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
            {/* Sutherland Logo */}
            <div className="flex justify-center mb-4">
              <div className="relative w-full h-8 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Sutherland Logo"
                  className={cn(
                    "absolute w-full h-auto object-contain transition-opacity duration-300 ease-in-out",
                    isExpanded ? "opacity-100" : "opacity-0"
                  )}
                />
                <img
                  src="/logo-small.png"
                  alt="Sutherland Logo"
                  className={cn(
                    "absolute w-8 h-8 object-contain transition-opacity duration-300 ease-in-out",
                    isExpanded ? "opacity-0" : "opacity-100"
                  )}
                />
              </div>
            </div>
            <Separator className="my-2" />
            {/* User Info */}
            <Button
              variant="ghost"
              className="w-full justify-start h-10 relative pl-3"
              onClick={() => navigate("/settings")}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <div
                className={cn(
                  "ml-3 flex flex-col items-start transition-all duration-300 ease-in-out absolute left-[2.5rem]",
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-4",
                )}
              >
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user.role?.replace("_", " ")}
                </span>
              </div>
            </Button>
            <Separator className="my-2" />
            <Button
              variant="ghost"
              className="w-full justify-start h-10 relative"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  "ml-3 transition-all duration-300 ease-in-out absolute left-[2.5rem]",
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-4",
                )}
              >
                Logout
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}