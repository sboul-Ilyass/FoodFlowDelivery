import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
import { ClipboardList, Clock, CheckCircle2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/merchant/")({
  component: MerchantDashboard,
});

function MerchantDashboard() {
  const auth = useAuth();
  const qc = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ["merchant-orders", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,created_at,assigned_courier_id,customer_id,customers(name,address)")
        .eq("merchant_id", auth.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancelOrder = async (id: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["merchant-orders", auth.userId] });
    }
  };

  const total = orders?.length ?? 0;
  const pending = orders?.filter((o) => o.status === "PENDING").length ?? 0;
  const completed = orders?.filter((o) => o.status === "COMPLETED").length ?? 0;

  return (
    <AppShell title="Merchant Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Orders" value={total} icon={ClipboardList} tone="primary" />
          <StatCard label="Pending" value={pending} icon={Clock} tone="warning" />
          <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="success" />
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Your Orders</h2>
          <Button asChild>
            <Link to="/merchant/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Create order
            </Link>
          </Button>
        </div>

        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Due Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o: any) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customers?.name}</div>
                    <div className="text-xs text-muted-foreground">{o.customers?.address}</div>
                  </td>
                  <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status !== "COMPLETED" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">Cancel</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently cancel and delete this order.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelOrder(o.id)}>Cancel Order</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No orders yet. Create your first one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

