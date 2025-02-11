import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Queue from "@/pages/queue";
import Reports from "@/pages/reports";
import Team from "@/pages/team";
import Settings from "@/pages/settings";
import ModeratePage from "@/pages/moderate";
import Users from "@/pages/users";
import SidebarNav from "@/components/sidebar-nav";
import UserInfo from "@/components/user-info";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r bg-card">
        <div className="flex flex-col h-full">
          <div className="border-b">
            <UserInfo />
          </div>
          <SidebarNav />
        </div>
      </div>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function PrivateRoute({ component: Component, params = {} }: { component: React.ComponentType<any>, params?: object }) {
  const [location] = useLocation();

  // For now, we'll assume the user is authenticated if they're not on the login page
  const isAuthenticated = location !== "/";

  if (!isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Component {...params} />
    </AuthenticatedLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/queue" component={() => <PrivateRoute component={Queue} />} />
      <Route path="/reports" component={() => <PrivateRoute component={Reports} />} />
      <Route path="/team" component={() => <PrivateRoute component={Team} />} />
      <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
      <Route path="/users" component={() => <PrivateRoute component={Users} />} />
      <Route path="/moderate/:id" component={(params) => <PrivateRoute component={ModeratePage} params={params} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;