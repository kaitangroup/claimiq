import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    email: "", password: "", firstName: "", lastName: "",
    firm: "", phone: "", barNumber: "", district: "",
  });

  const login = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/auth/login", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/portal");
    },
    onError: (e: any) => toast({ title: "Login failed", description: e.message, variant: "destructive" }),
  });

  const register = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/auth/register", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/portal");
    },
    onError: (e: any) => toast({ title: "Registration failed", description: e.message, variant: "destructive" }),
  });

  const field = (label: string, key: string, form: any, setForm: any, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <label className="text-sm font-medium font-body mb-1 block">{label}{opts?.required !== false ? " *" : ""}</label>
      <input
        data-testid={`input-${key}`}
        type={opts?.type || "text"}
        value={form[key]}
        placeholder={opts?.placeholder}
        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
        required={opts?.required !== false}
        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body"
      />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-secondary/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <Scale size={22} className="text-gold" />
            <span className="font-display text-xl font-semibold">ClaimIQ Trustee Portal</span>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex gap-1 bg-muted rounded-lg p-1 mb-2">
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 text-sm py-1.5 rounded-md font-body font-medium transition-colors capitalize ${
                    mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            <CardTitle className="font-display text-xl font-semibold">
              {mode === "login" ? "Welcome back" : "Register as a Trustee"}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-body">
              {mode === "login"
                ? "Sign in to access your cases and portfolio submissions."
                : "Create a free account to submit avoidance action portfolios for due diligence and purchase offers."}
            </p>
          </CardHeader>

          <CardContent>
            {mode === "login" ? (
              <form onSubmit={e => { e.preventDefault(); login.mutate(loginForm); }} className="space-y-4">
                {field("Email Address", "email", loginForm, setLoginForm, { type: "email" })}
                {field("Password", "password", loginForm, setLoginForm, { type: "password" })}
                <Button data-testid="button-login" type="submit" disabled={login.isPending}
                  className="w-full bg-navy hover:bg-navy-mid text-white font-body">
                  {login.isPending ? "Signing in..." : "Sign In"}
                </Button>
                <p className="text-center text-sm text-muted-foreground font-body">
                  No account?{" "}
                  <button type="button" onClick={() => setMode("register")} className="text-[hsl(var(--gold))] hover:underline font-medium">
                    Register here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); register.mutate(regForm); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {field("First Name", "firstName", regForm, setRegForm)}
                  {field("Last Name", "lastName", regForm, setRegForm)}
                </div>
                {field("Email Address", "email", regForm, setRegForm, { type: "email" })}
                {field("Password", "password", regForm, setRegForm, { type: "password", placeholder: "Minimum 8 characters" })}
                {field("Firm / Organization", "firm", regForm, setRegForm, { required: false })}
                <div className="grid grid-cols-2 gap-3">
                  {field("Phone", "phone", regForm, setRegForm, { required: false })}
                  {field("Bar Number", "barNumber", regForm, setRegForm, { required: false })}
                </div>
                {field("District", "district", regForm, setRegForm, { required: false, placeholder: "e.g. M.D. Fla." })}
                <Button data-testid="button-register" type="submit" disabled={register.isPending}
                  className="w-full bg-navy hover:bg-navy-mid text-white font-body">
                  {register.isPending ? "Creating account..." : "Create Account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center font-body leading-relaxed">
                  By registering, you confirm you are a licensed bankruptcy trustee or authorized representative.
                  All submissions are handled confidentially.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
