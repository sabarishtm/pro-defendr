import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const statusOptions = [
  { value: "online", label: "Online" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

export default function AgentStatus() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/users/me"],
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("POST", "/api/users/status", { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
  });

  if (!user) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Welcome, {user.name}</h2>
        <Badge variant="outline">{user.role}</Badge>
      </div>
      <Select
        value={user.status}
        onValueChange={(value) => statusMutation.mutate(value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
