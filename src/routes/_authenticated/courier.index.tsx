import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Timer, CheckCircle2 } from "lucide-react";
import { optimizeRoute, type TravelEdge } from "@/lib/routeOptimizer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courier/")({
  component: CourierDashboard,
});

function CourierDashboard() {
  const auth = useAuth();
  const qc = useQueryClient();

  const { data: available } = useQuery({
    queryKey: ["available-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,customer_id,customers(name,address,code)")
        .eq("status", "PENDING")
        .order("due_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-orders", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,customer_id,customers(name,address,code)")
        .eq("assigned_courier_id", auth.userId!)
        .order("due_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: travel } = useQuery({
    queryKey: ["travel-times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_times")
        .select("from_location,to_location,travel_minutes");
      if (error) throw error;
      return data as TravelEdge[];
    },
  });

  const accepted = (mine ?? []).filter((o) => o.status === "ASSIGNED");
  const completed = (mine ?? []).filter((o) => o.status === "COMPLETED");

  const optimized = useMemo(() => {
    if (!travel || accepted.length === 0) return null;
    const labels: Record<string, string> = { R: "Restaurant" };
    const codes: string[] = [];
    for (const o of accepted) {
      const c: any = o.customers;
      if (c?.code) {
        codes.push(c.code);
        labels[c.code] = `${c.name} — ${c.address}`;
      }
    }
    return optimizeRoute(codes, labels, travel);
  }, [travel, accepted]);

  const accept = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ assigned_courier_id: auth.userId, status: "ASSIGNED" })
      .eq("id", orderId)
      .eq("status", "PENDING");
    if (error) toast.error(error.message);
    else {
      toast.success("Order accepted");
      qc.invalidateQueries({ queryKey: ["available-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };

  const complete = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "COMPLETED" })
      .eq("id", orderId)
      .eq("assigned_courier_id", auth.userId!);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked completed");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };

  const cancelAcceptance = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ assigned_courier_id: null, status: "PENDING" })
      .eq("id", orderId)
      .eq("assigned_courier_id", auth.userId!);
    if (error) toast.error(error.message);
    else {
      toast.success("Delivery assignment cancelled");
      qc.invalidateQueries({ queryKey: ["available-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };

  return (
    <AppShell title="Courier Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Available Orders" value={available?.length ?? 0} icon={Package} tone="warning" />
          <StatCard label="Accepted" value={accepted.length} icon={Truck} tone="primary" />
          <StatCard label="Completed" value={completed.length} icon={CheckCircle2} tone="success" />
        </div>

        <section className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Optimized Delivery Route
          </h2>
          {optimized && optimized.stops.length > 1 ? (
            <div>
              <ol className="space-y-2">
                {optimized.stops.map((s, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.label}</div>
                      {i > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {s.travelFromPrev} min from previous stop
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4 text-primary" />
                <span className="font-medium">Total estimated travel:</span>
                <span>{optimized.totalMinutes} minutes</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Accept one or more deliveries to see the optimized sequence.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-3">Available Pending Orders</h2>
          <div className="bg-card border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Time</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(available ?? []).map((o: any) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.customers?.name}</div>
                      <div className="text-xs text-muted-foreground">{o.customers?.address}</div>
                    </td>
                    <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => accept(o.id)}>Accept</Button>
                    </td>
                  </tr>
                ))}
                {available?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No pending orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">My Accepted Orders</h2>
          <div className="bg-card border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(mine ?? []).map((o: any) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.customers?.name}</div>
                      <div className="text-xs text-muted-foreground">{o.customers?.address}</div>
                    </td>
                    <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {o.status === "ASSIGNED" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => complete(o.id)}>
                            Mark completed
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                            if (window.confirm("Cancel this delivery assignment?")) {
                              cancelAcceptance(o.id);
                            }
                          }}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {mine?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No accepted orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
