import { Switch, Route } from "wouter";
import { I18nProvider } from "@/i18n/i18n";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotCode from "@/pages/ForgotCode";
import SampleEvaluation from "@/pages/SampleEvaluation";
import NotFound from "@/pages/NotFound";
import "@/styles/global.css";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-code" component={ForgotCode} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/samples/:id/evaluate" component={SampleEvaluation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;
