import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell, StatusBadge } from "@/components/AppShell";
import { MapPin, ShoppingBag } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/customer/orders")({
  component: CustomerOrders,
});

function CustomerOrders() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!auth.loading && auth.role !== "CUSTOMER") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const { data: orders } = useQuery({
    queryKey: ["my-customer-orders", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,due_time,created_at,delivery_address,products(name,price)")
        .eq("customer_user_id", auth.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancelOrder = async (id: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["my-customer-orders", auth.userId] });
    }
  };

  const cancellable = (status: string) => status === "PENDING" || status === "READY";

  return (
    <AppShell title="My Orders">
      <div className="max-w-4xl space-y-5">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4" />
          {orders?.length ?? 0} order{orders?.length !== 1 ? "s" : ""}
        </p>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Delivery address</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o: any) => (
                <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.products?.name ?? "—"}</div>
                    {o.products?.price != null && (
                      <div className="text-xs text-muted-foreground">
                        €{Number(o.products.price).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {o.delivery_address ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {cancellable(o.status) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone. Once a courier picks up your order it can no longer be cancelled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep order</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelOrder(o.id)}>
                              Cancel order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ShoppingBag className="h-8 w-8 opacity-30" />
                      <p className="text-sm">No orders yet</p>
                      <button
                        onClick={() => navigate({ to: "/customer" })}
                        className="text-emerald-600 text-sm hover:underline font-medium"
                      >
                        Browse the menu →
                      </button>
                    </div>
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
