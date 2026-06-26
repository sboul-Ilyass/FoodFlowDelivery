import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, Timer, CheckCircle2, AlertTriangle } from "lucide-react";
import { optimizeRoute, type TravelEdge } from "@/lib/routeOptimizer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DeliveryMap } from "@/components/DeliveryMap";

export const Route = createFileRoute("/_authenticated/courier/")({
  component: CourierDashboard,
});

// ---------------------------------------------------------------------------
// Timeout validation
// Returns an error string if adding candidateOrder to activeBatch would
// cause any delivery to miss its due_time, null otherwise.
// ---------------------------------------------------------------------------
function checkBatchTimeout(
  candidateOrder: any,
  activeBatch: any[],
  travelEdges: TravelEdge[],
): string | null {
  const allOrders = [...activeBatch, candidateOrder];
  const codes = allOrders
    .map((o: any) => o.customers?.code)
    .filter((c): c is string => Boolean(c));

  if (codes.length === 0) return null; // no predefined codes → can't validate, allow

  const labels: Record<string, string> = { R: "Restaurant" };
  for (const o of allOrders) {
    const c = o.customers as any;
    if (c?.code) labels[c.code] = c.name ?? c.code;
  }

  const route = optimizeRoute(codes, labels, travelEdges);
  const now = Date.now();
  let cumMs = 0;

  for (const stop of route.stops) {
    cumMs += stop.travelFromPrev * 60_000;
    if (stop.code === "R") continue;

    const order = allOrders.find((o: any) => o.customers?.code === stop.code);
    if (!order) continue;

    const dueMs = new Date(order.due_time).getTime();
    const etaMs = now + cumMs;

    if (etaMs > dueMs) {
      const overMin = Math.ceil((etaMs - dueMs) / 60_000);
      const name = (order.customers as any)?.name ?? "a customer";
      return `Adding this order would deliver to ${name} ~${overMin} min late`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// CourierDashboard
// ---------------------------------------------------------------------------
function CourierDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!auth.loading && auth.role !== "COURIER") {
      navigate({ to: roleHome(auth.role) });
    }
  }, [auth.loading, auth.role, navigate]);

  // Pool of orders ready for pickup (merchant has confirmed meal is ready)
  const { data: available } = useQuery({
    queryKey: ["available-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,customer_id,customer_user_id,delivery_address,customers(name,address,code)")
        .eq("status", "READY")
        .order("due_time");
      if (error) throw error;
      return data;
    },
  });

  // This courier's active batch + past deliveries
  const { data: mine } = useQuery({
    queryKey: ["my-orders", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,customer_id,customer_user_id,delivery_address,customers(name,address,code)")
        .eq("assigned_courier_id", auth.userId!)
        .in("status", ["IN_DELIVERY", "DELIVERED"])
        .order("due_time");
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for orders placed by registered customers (customer_user_id path)
  const customerUserIds = useMemo(() => Array.from(new Set([
    ...(available ?? []).map((o: any) => o.customer_user_id),
    ...(mine ?? []).map((o: any) => o.customer_user_id),
  ].filter(Boolean))), [available, mine]);

  const { data: customerProfiles } = useQuery({
    queryKey: ["courier-customer-profiles", customerUserIds.join(",")],
    enabled: customerUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", customerUserIds as string[]);
      if (error) throw error;
      return data;
    },
  });

  // Resolve display name + address for any order regardless of which customer path was used
  const customerInfo = (o: any): { name: string; address: string } => {
    if (o.customers?.name) return { name: o.customers.name, address: o.customers.address ?? "" };
    const profile = (customerProfiles ?? []).find((p) => p.id === o.customer_user_id);
    return { name: profile?.name ?? "Customer", address: o.delivery_address ?? "" };
  };

  // Predefined travel times table (from Supabase) for route optimization
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

  const active    = (mine ?? []).filter((o) => o.status === "IN_DELIVERY");
  const delivered = (mine ?? []).filter((o) => o.status === "DELIVERED");

  // Pre-compute timeout block reason for each available order
  const timeoutReasons = useMemo(() => {
    const map = new Map<string, string | null>();
    if (!travel) return map;
    for (const o of available ?? []) {
      map.set(o.id, checkBatchTimeout(o, active, travel));
    }
    return map;
  }, [available, active, travel]);

  // Optimized route for the active batch
  const optimized = useMemo(() => {
    if (!travel || active.length === 0) return null;
    const labels: Record<string, string> = { R: "Restaurant" };
    const codes: string[] = [];
    for (const o of active) {
      const c = o.customers as any;
      if (c?.code) {
        codes.push(c.code);
        labels[c.code] = `${c.name} — ${c.address}`;
      }
    }
    if (codes.length === 0) return null;
    return optimizeRoute(codes, labels, travel);
  }, [travel, active]);

  // Add an order to the batch — button is pre-disabled if timeout exceeded, but double-check here
  const addToBatch = async (order: any) => {
    const { error, count } = await supabase
      .from("orders")
      .update({ assigned_courier_id: auth.userId, status: "IN_DELIVERY" }, { count: "exact" })
      .eq("id", order.id)
      .eq("status", "READY"); // Optimistic concurrency — prevents double-claiming

    if (error) {
      toast.error(error.message);
    } else if (count === 0) {
      toast.error("Order was just taken — refreshing list");
      qc.invalidateQueries({ queryKey: ["available-orders"] });
    } else {
      toast.success("Order added to your batch");
      qc.invalidateQueries({ queryKey: ["available-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders", auth.userId] });
    }
  };

  const markDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "DELIVERED" })
      .eq("id", orderId)
      .eq("assigned_courier_id", auth.userId!);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as delivered");
      qc.invalidateQueries({ queryKey: ["my-orders", auth.userId] });
    }
  };

  const dropFromBatch = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ assigned_courier_id: null, status: "READY" })
      .eq("id", orderId)
      .eq("assigned_courier_id", auth.userId!);
    if (error) toast.error(error.message);
    else {
      toast.success("Order released back to pool");
      qc.invalidateQueries({ queryKey: ["available-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders", auth.userId] });
    }
  };

  return (
    <AppShell title="Courier Dashboard">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Ready to Pick Up" value={available?.length ?? 0} icon={Package}       tone="warning" />
          <StatCard label="In My Batch"       value={active.length}          icon={Truck}         tone="primary" />
          <StatCard label="Delivered Today"   value={delivered.length}       icon={CheckCircle2}  tone="success" />
        </div>

        {/* Map + route */}
        <section className="bg-card border rounded-lg p-5 space-y-5">
          <h2 className="font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Delivery Map &amp; Route
          </h2>

          <DeliveryMap
            active={active}
            available={available ?? []}
            optimized={optimized}
          />

          {optimized && optimized.stops.length > 1 ? (
            <div className="pt-1 border-t">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Stop sequence</p>
              <ol className="space-y-2">
                {optimized.stops.map((s, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.label}</div>
                      {i > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {s.travelFromPrev} min from previous stop
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Total estimated travel:</span>
                <span>{optimized.totalMinutes} min</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pt-1 border-t">
              Add orders to your batch to see the optimized route.
            </p>
          )}
        </section>

        {/* Available READY orders */}
        <section>
          <h2 className="font-semibold mb-3">Orders Ready for Pickup</h2>
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
                {(available ?? []).map((o: any) => {
                  const blockReason = timeoutReasons.get(o.id) ?? null;
                  return (
                    <tr key={o.id} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{customerInfo(o).name}</div>
                        <div className="text-xs text-muted-foreground">{customerInfo(o).address}</div>
                      </td>
                      <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div title={blockReason ?? undefined} className="inline-block">
                          <Button
                            size="sm"
                            disabled={!!blockReason}
                            onClick={() => addToBatch(o)}
                          >
                            {blockReason ? (
                              <><AlertTriangle className="h-3 w-3 mr-1" /> Too late</>
                            ) : "Add to batch"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(available?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No orders ready for pickup yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Active batch */}
        <section>
          <h2 className="font-semibold mb-3">My Active Batch</h2>
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
                {active.map((o: any) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{customerInfo(o).name}</div>
                      <div className="text-xs text-muted-foreground">{customerInfo(o).address}</div>
                    </td>
                    <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button size="sm" onClick={() => markDelivered(o.id)}>
                        Mark Delivered
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">Drop</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Drop this order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The order goes back to the pool so another courier can pick it up.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => dropFromBatch(o.id)}>Drop order</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
                {active.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No orders in your batch — add some from the pool above
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Delivered today */}
        {delivered.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3">Delivered Today</h2>
            <div className="bg-card border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Due Time</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {delivered.map((o: any) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{customerInfo(o).name}</div>
                        <div className="text-xs text-muted-foreground">{customerInfo(o).address}</div>
                      </td>
                      <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </AppShell>
  );
}

