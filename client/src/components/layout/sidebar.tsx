import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutDashboard, 
  ListChecks, 
  BarChart,
  LogOut
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/queue", label: "Moderation Queue", icon: ListChecks },
    { href: "/reports", label: "Reports", icon: BarChart },
  ];

  return (
    <div className="flex flex-col h-screen border-r bg-sidebar">
      <div className="p-6">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          Content Moderation
        </h1>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="px-4 space-y-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button
                variant={location === href ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}