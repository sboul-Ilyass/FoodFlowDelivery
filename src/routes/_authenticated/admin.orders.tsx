import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { adminAssignCourier, adminListCouriers } from "@/lib/admin.functions";
import { useAuth, roleHome } from "@/lib/useAuth";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listCouriers  = useServerFn(adminListCouriers);
  const assignCourier = useServerFn(adminAssignCourier);

  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,assigned_courier_id,merchant_id,customer_user_id,delivery_address,customers(name,address),products(name),created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const allIds = Array.from(new Set([
    ...(orders ?? []).map((o: any) => o.merchant_id),
    ...(orders ?? []).map((o: any) => o.assigned_courier_id).filter(Boolean),
  ])).filter(Boolean) as string[];

  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-orders", allIds.join(",")],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", allIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriers(),
  });

  const nameOf = (id?: string | null) =>
    (profiles ?? []).find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  const assign = async (orderId: string, courierId: string | null) => {
    try {
      await assignCourier({ data: { orderId, courierId } });
      toast.success("Courier updated");
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["profiles-for-orders"] });
    }
  };

  return (
    <AppShell title="Orders">
      <div className="rounded-xl border bg-card overflow-x-auto max-w-7xl">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Courier</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: any) => (
              <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium">{nameOf(o.merchant_id)}</td>
                <td className="px-4 py-3">
                  {o.customers?.name ? (
                    <>
                      <div className="font-medium">{o.customers.name}</div>
                      <div className="text-xs text-muted-foreground">{o.customers.address}</div>
                    </>
                  ) : o.delivery_address ? (
                    <>
                      <div className="text-sm flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /> {o.delivery_address}
                      </div>
                      {o.products?.name && (
                        <div className="text-xs text-muted-foreground">
                          {o.products.name}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(o.due_time).toLocaleString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 min-w-[180px]">
                  <Select
                    value={o.assigned_courier_id ?? "none"}
                    onValueChange={(v) => assign(o.id, v === "none" ? null : v)}
                    disabled={o.status === "COMPLETED"}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(couriers ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 text-xs">
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the order. The action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Go back</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteOrder(o.id)}>Cancel order</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
            {orders?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                  No orders yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
