import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LogOut,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const auth = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight text-lg mr-2 hidden sm:inline">FoodFlow</span>
            <span className="text-muted-foreground hidden sm:inline">|</span>
            <h1 className="text-base sm:text-lg font-medium text-foreground sm:ml-2 truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline">{auth.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: typeof LayoutDashboard;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "success"
        ? "bg-success/10 text-success"
        : tone === "warning"
          ? "bg-warning/15 text-warning-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-lg border bg-card p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </div>
      <div className={`rounded-md p-2 ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-warning/20 text-warning-foreground",
    ASSIGNED: "bg-primary/15 text-primary",
    COMPLETED: "bg-success/15 text-success",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        map[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

