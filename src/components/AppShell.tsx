import { ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LogOut,
  UtensilsCrossed,
  Users,
  Package,
  ClipboardList,
  Map,
  ShoppingBag,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppRole = "ADMIN" | "MERCHANT" | "COURIER" | "CUSTOMER";

interface NavItem {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  exact?: boolean;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  ADMIN: [
    { to: "/admin",          icon: LayoutDashboard, label: "Overview",     exact: true },
    { to: "/admin/users",    icon: Users,           label: "Users" },
    { to: "/admin/products", icon: Package,         label: "Products" },
    { to: "/admin/orders",   icon: ClipboardList,   label: "Orders" },
  ],
  MERCHANT: [
    { to: "/merchant",          icon: ClipboardList,   label: "Orders",      exact: true },
    { to: "/merchant/products", icon: Package,         label: "My Products" },
  ],
  COURIER: [
    { to: "/courier", icon: Map, label: "Dashboard", exact: true },
  ],
  CUSTOMER: [
    { to: "/customer",        icon: UtensilsCrossed, label: "Menu",       exact: true },
    { to: "/customer/orders", icon: ShoppingBag,     label: "My Orders" },
  ],
};

const ROLE_LABEL: Record<AppRole, string> = {
  ADMIN:    "Administrator",
  MERCHANT: "Merchant",
  COURIER:  "Courier",
  CUSTOMER: "Customer",
};

// All classes must be literal strings so Tailwind doesn't purge them
const ACCENT: Record<AppRole, {
  activeBg: string;
  activeText: string;
  avatar: string;
  badge: string;
}> = {
  ADMIN:    { activeBg: "bg-violet-50",  activeText: "text-violet-700",  avatar: "bg-violet-600",  badge: "bg-violet-100 text-violet-700" },
  MERCHANT: { activeBg: "bg-orange-50",  activeText: "text-orange-700",  avatar: "bg-orange-500",  badge: "bg-orange-100 text-orange-700" },
  COURIER:  { activeBg: "bg-blue-50",    activeText: "text-blue-700",    avatar: "bg-blue-600",    badge: "bg-blue-100 text-blue-700" },
  CUSTOMER: { activeBg: "bg-emerald-50", activeText: "text-emerald-700", avatar: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
};

// ─── AppShell ────────────────────────────────────────────────────────────────

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = auth.role as AppRole | null;
  const navItems = role ? NAV_ITEMS[role] : [];
  const accent = role ? ACCENT[role] : null;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const initials = auth.name
    ? auth.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (auth.email ?? "?").slice(0, 2).toUpperCase();

  // ── Sidebar content (shared between desktop + mobile) ────────────────────
  function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
    return (
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <UtensilsCrossed className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">FoodFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? cn("font-medium", accent?.activeBg, accent?.activeText)
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t space-y-2 shrink-0">
          {/* Avatar + name + email */}
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white",
                accent?.avatar ?? "bg-primary"
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight truncate">
                {auth.name ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground truncate">{auth.email}</div>
            </div>
          </div>

          {/* Role badge */}
          {role && accent && (
            <div
              className={cn(
                "mx-2 rounded-md px-2 py-0.5 text-xs font-medium text-center",
                accent.badge
              )}
            >
              {ROLE_LABEL[role]}
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — fixed */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-30 w-64 bg-card border-r">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — slide-over */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Panel */}
          <aside className="absolute left-0 inset-y-0 w-72 bg-card border-r flex flex-col shadow-xl">
            {/* Close button */}
            <button
              className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground z-10"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavClick={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Sticky top bar */}
        <header className="h-14 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold truncate text-foreground">{title}</h1>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.FC<{ className?: string }>;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const iconClass =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "success" ? "bg-emerald-100 text-emerald-600"
    : tone === "warning" ? "bg-amber-100 text-amber-600"
    : "bg-muted text-muted-foreground";

  const borderClass =
    tone === "primary" ? "border-l-primary"
    : tone === "success" ? "border-l-emerald-500"
    : tone === "warning" ? "border-l-amber-500"
    : "border-l-transparent";

  return (
    <div className={cn("rounded-xl border-l-4 border bg-card p-5 flex items-center justify-between gap-4", borderClass)}>
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </div>
      <div className={cn("rounded-xl p-2.5 shrink-0", iconClass)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "PENDING"     ? "bg-amber-100 text-amber-700 border border-amber-200"
    : status === "READY"       ? "bg-sky-100 text-sky-700 border border-sky-200"
    : status === "IN_DELIVERY" ? "bg-blue-100 text-blue-700 border border-blue-200"
    : status === "DELIVERED"   ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : status === "ASSIGNED"    ? "bg-blue-100 text-blue-700 border border-blue-200"
    : status === "COMPLETED"   ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : "bg-muted text-muted-foreground border";

  const label =
    status === "IN_DELIVERY" ? "In Delivery"
    : status === "DELIVERED"  ? "Delivered"
    : status;

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
