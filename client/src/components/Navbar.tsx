import { Link, useLocation } from "wouter";
import { Moon, Sun, ChevronRight, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Navbar() {
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const { data: meRaw } = useQuery({ queryKey: ["/api/auth/me"], retry: false });
  const me = meRaw as any;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => { qc.clear(); navigate("/"); },
  });

  const navLink = (href: string, label: string) => (
    <Link href={href}>
      <span className={`text-sm font-medium transition-colors cursor-pointer px-1 pb-0.5 border-b-2 font-body ${
        location === href
          ? "border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}>{label}</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer select-none">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-label="ClaimIQ" className="flex-shrink-0">
              <rect width="34" height="34" rx="7" fill="hsl(222,44%,17%)"/>
              {/* Scales */}
              <line x1="17" y1="7" x2="17" y2="27" stroke="hsl(42,85%,52%)" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="9.5" y1="10" x2="24.5" y2="10" stroke="hsl(42,85%,52%)" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M9.5 10 L9.5 12.5" stroke="hsl(42,85%,52%)" strokeWidth="1.3"/>
              <path d="M24.5 10 L24.5 12.5" stroke="hsl(42,85%,52%)" strokeWidth="1.3"/>
              <circle cx="9.5" cy="15.5" r="3.5" stroke="hsl(42,85%,52%)" strokeWidth="1.3" fill="none"/>
              <circle cx="24.5" cy="15.5" r="3.5" stroke="hsl(42,85%,52%)" strokeWidth="1.3" fill="none"/>
              {/* Bar chart accent */}
              <rect x="13" y="22.5" width="2.2" height="4.5" rx="0.5" fill="hsl(42,85%,52%)" opacity="0.65"/>
              <rect x="16" y="20.5" width="2.2" height="6.5" rx="0.5" fill="hsl(42,85%,52%)"/>
              <rect x="19" y="23.5" width="2.2" height="3.5" rx="0.5" fill="hsl(42,85%,52%)" opacity="0.65"/>
            </svg>
            <div>
              <div className="font-display text-base font-semibold leading-none tracking-tight">ClaimIQ</div>
              <div className="text-[10px] text-muted-foreground leading-none mt-0.5 tracking-wide uppercase font-body">
                Avoidance Action Finance
              </div>
            </div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLink("/", "For Trustees")}
          {me && navLink("/portal", "My Cases")}
          {me && navLink("/documents", "Documents")}
          {me?.isAdmin && navLink("/admin", "Admin")}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setDark(d => !d)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme" data-testid="theme-toggle">
            {dark ? <Sun size={16}/> : <Moon size={16}/>}
          </button>

          {me ? (
            <div className="flex items-center gap-2">
              <Link href="/portal">
                <Button size="sm" variant="outline" className="font-body text-xs hidden sm:flex">
                  {me.firstName} {me.lastName}
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => logout.mutate()} className="font-body text-xs text-muted-foreground">
                <LogOut size={13} className="mr-1"/>Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth">
                <Button size="sm" variant="outline" className="font-body hidden sm:flex">Sign In</Button>
              </Link>
              <Link href="/auth">
                <Button size="sm" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-mid))] text-white font-body">
                  Submit Portfolio <ChevronRight size={13} className="ml-0.5"/>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
