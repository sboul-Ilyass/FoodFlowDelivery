import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const listCouriers = useServerFn(adminListCouriers);
  const assignCourier = useServerFn(adminAssignCourier);

  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,assigned_courier_id,merchant_id,customers(name,address),created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const merchantIds = Array.from(new Set((orders ?? []).map((o: any) => o.merchant_id))).filter(Boolean);
  const courierIds = Array.from(new Set((orders ?? []).map((o: any) => o.assigned_courier_id).filter(Boolean)));
  const allIds = Array.from(new Set([...merchantIds, ...courierIds]));

  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-orders", allIds.join(",")],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", allIds);
      if (error) throw error;
      return data;
    },
  });
  const nameOf = (id?: string | null) =>
    (profiles ?? []).find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriers(),
  });

  const assign = async (orderId: string, courierId: string | null) => {
    try {
      await assignCourier({ data: { orderId, courierId } });
      toast.success("Updated");
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
    }
  };

  return (
    <AppShell title="Manage Orders">
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Due Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Courier</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{nameOf(o.merchant_id)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.customers?.name}</div>
                  <div className="text-xs text-muted-foreground">{o.customers?.address}</div>
                </td>
                <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 min-w-[200px]">
                  <Select
                    value={o.assigned_courier_id ?? "none"}
                    onValueChange={(v) => assign(o.id, v === "none" ? null : v)}
                    disabled={o.status === "COMPLETED"}
                  >
                    <SelectTrigger className="h-8">
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
                      <Button size="sm" variant="ghost" className="text-destructive">Cancel</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel order?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently cancel and delete this order.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteOrder(o.id)}>Cancel Order</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
            {orders?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No orders</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
