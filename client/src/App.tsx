import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/dashboard";
import PreTravelForm from "./pages/form/pre-travel";
import PostTravelForm from "./pages/form/post-travel";
import ProfilePage from "./pages/profile";
import AdminPage from "./pages/admin";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ExampleForm from "@/pages/example-form"; 
import { useUser } from "@/hooks/use-user";
import { Loader2, User, Home, Plus, Settings, Car } from "lucide-react";
import { NotificationsButton } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import ErrorBoundary from "@/components/ErrorBoundary";
import { motion } from "framer-motion";
import VehicleManagement from "./pages/VehicleManagement";

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <motion.h1 
              className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Travello.ai
            </motion.h1>
            <nav className="hidden md:flex items-center space-x-4">
              <Button variant={location === "/" ? "default" : "ghost"} size="sm" asChild>
                <Link href="/" className="flex items-center">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant={location === "/new-request" ? "default" : "ghost"} size="sm" asChild>
                <Link href="/new-request" className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Link>
              </Button>
              <Button variant={location === "/vehicles" ? "default" : "ghost"} size="sm" asChild>
                <Link href="/vehicles" className="flex items-center">
                  <Car className="mr-2 h-4 w-4" />
                  Company Vehicles
                </Link>
              </Button>
              {user?.role === 'super_admin' && (
                <Button variant={location === "/admin" ? "default" : "ghost"} size="sm" asChild>
                  <Link href="/admin" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Administration
                  </Link>
                </Button>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Logout
            </Button>
            <Button variant={location === "/profile" ? "default" : "ghost"} size="icon" asChild>
              <Link href="/profile">
                <User className="h-5 w-5" />
              </Link>
            </Button>
            <NotificationsButton />
          </div>
        </div>
      </header>
      <main>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/new-request" component={PreTravelForm} />
        <Route path="/forms/:id/post-travel" component={PostTravelForm} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/vehicles" component={VehicleManagement} />
        <Route path="/example" component={ExampleForm} />
        {user.role === 'super_admin' && (
          <Route path="/admin" component={AdminPage} />
        )}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;