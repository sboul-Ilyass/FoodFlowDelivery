import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
import {
  Users,
  Store,
  Truck,
  ClipboardList,
  Clock,
  CheckCircle2,
  ChevronRight,
  Package,
  ShoppingBag,
} from "lucide-react";
import { adminListUsers } from "@/lib/admin.functions";
import { useAuth, roleHome } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const listUsers = useServerFn(adminListUsers);

  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,merchant_id,customer_user_id,delivery_address,customers(name,address),products(name),created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const merchantCount = users?.filter((u) => u.role === "MERCHANT").length ?? 0;
  const courierCount  = users?.filter((u) => u.role === "COURIER").length  ?? 0;
  const totalOrders   = orders?.length ?? 0;
  const pending       = orders?.filter((o) => o.status === "PENDING").length   ?? 0;
  const completed     = orders?.filter((o) => o.status === "COMPLETED").length ?? 0;
  const recentOrders  = (orders ?? []).slice(0, 5);

  return (
    <AppShell title="Overview">
      <div className="space-y-8 max-w-6xl">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Users"  value={users?.length ?? 0} icon={Users}         tone="primary" />
          <StatCard label="Merchants"    value={merchantCount}      icon={Store} />
          <StatCard label="Couriers"     value={courierCount}       icon={Truck} />
          <StatCard label="All Orders"   value={totalOrders}        icon={ClipboardList}  tone="primary" />
          <StatCard label="Pending"      value={pending}            icon={Clock}          tone="warning" />
          <StatCard label="Completed"    value={completed}          icon={CheckCircle2}   tone="success" />
        </div>

        {/* ── Quick nav cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Manage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { to: "/admin/users",    icon: Users,         label: "Users",    desc: `${users?.length ?? 0} accounts`,    color: "text-violet-600 bg-violet-50" },
              { to: "/admin/products", icon: Package,       label: "Products",  desc: "Catalog & availability",           color: "text-orange-600 bg-orange-50" },
              { to: "/admin/orders",   icon: ShoppingBag,   label: "Orders",    desc: `${pending} pending · ${completed} completed`, color: "text-blue-600 bg-blue-50" },
            ].map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="group flex items-center gap-4 rounded-xl border bg-card p-5 hover:shadow-md hover:border-border/80 transition-all"
              >
                <div className={`rounded-xl p-3 shrink-0 ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{card.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{card.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent orders ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Orders
            </h2>
            <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      {o.customers?.name
                        ? <><div className="font-medium">{o.customers.name}</div><div className="text-xs text-muted-foreground">{o.customers.address}</div></>
                        : <div className="text-sm text-muted-foreground">{o.delivery_address ?? "—"}</div>
                      }
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.products?.name ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
