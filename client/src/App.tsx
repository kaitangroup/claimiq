import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Portal from "@/pages/Portal";
import CaseDetail from "@/pages/CaseDetail";
import Documents from "@/pages/Documents";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Navbar />
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={Auth} />
          <Route path="/portal" component={Portal} />
          <Route path="/case/:id" component={CaseDetail} />
          <Route path="/documents" component={Documents} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
