import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

export default function UserInfo() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/users/me"],
  });

  if (!user) return null;

  const roleColors = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    agent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    sr_agent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    queue_manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  };

  const roleColor = roleColors[user.role as keyof typeof roleColors] || roleColors.agent;

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
        <UserCircle className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{user.name}</span>
        <Badge variant="secondary" className={`text-xs ${roleColor}`}>
          {user.role.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')}
        </Badge>
      </div>
    </div>
  );
}
