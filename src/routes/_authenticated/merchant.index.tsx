import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell, StatCard, StatusBadge } from "@/components/AppShell";
import { ClipboardList, Clock, CheckCircle2, PlusCircle, ChefHat, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

type Order = {
  id: string;
  due_time: string;
  status: string;
  created_at: string;
  customer_id: string | null;
  delivery_address: string | null;
  customers: { name: string; address: string } | null;
  products: { name: string } | null;
};

// Converts a UTC ISO string to the local datetime-local input value
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MerchantDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!auth.loading && auth.role !== "MERCHANT") {
      navigate({ to: roleHome(auth.role) });
    }
  }, [auth.loading, auth.role, navigate]);

  const { data: orders } = useQuery({
    queryKey: ["merchant-orders", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,created_at,customer_id,delivery_address,customers(name,address),products(name)")
        .eq("merchant_id", auth.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // ── Edit dialog state ───────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState<"PENDING" | "READY">("PENDING");
  const [editDueTime, setEditDueTime] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = (o: Order) => {
    setEditing(o);
    setEditStatus(o.status as "PENDING" | "READY");
    setEditDueTime(toLocalInputValue(o.due_time));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: editStatus,
        due_time: new Date(editDueTime).toISOString(),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["merchant-orders", auth.userId] });
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const markReady = async (id: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "READY" })
      .eq("id", id)
      .eq("status", "PENDING");
    if (error) toast.error(error.message);
    else {
      toast.success("Order marked as ready for pickup");
      qc.invalidateQueries({ queryKey: ["merchant-orders", auth.userId] });
    }
  };

  const cancelOrder = async (id: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["merchant-orders", auth.userId] });
    }
  };

  const total     = orders?.length ?? 0;
  const pending   = orders?.filter((o) => o.status === "PENDING").length ?? 0;
  const ready     = orders?.filter((o) => o.status === "READY").length ?? 0;
  const delivered = orders?.filter((o) => o.status === "DELIVERED").length ?? 0;

  const editable   = (status: string) => status === "PENDING" || status === "READY";
  const cancellable = (status: string) => status === "PENDING" || status === "READY";

  return (
    <AppShell title="Merchant Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Total Orders"  value={total}     icon={ClipboardList} tone="primary" />
          <StatCard label="Pending"       value={pending}   icon={Clock}         tone="warning" />
          <StatCard label="Ready"         value={ready}     icon={ChefHat}       tone="primary" />
          <StatCard label="Delivered"     value={delivered} icon={CheckCircle2}  tone="success" />
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
              {(orders ?? []).map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {o.customers?.name ?? o.delivery_address ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.customers?.address ?? (o.products?.name ? `Product: ${o.products.name}` : "")}
                    </div>
                  </td>
                  <td className="px-4 py-3">{new Date(o.due_time).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {/* Quick mark-ready shortcut for PENDING orders */}
                    {o.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-sky-600 border-sky-200 hover:bg-sky-50"
                        onClick={() => markReady(o.id)}
                      >
                        <ChefHat className="h-3 w-3 mr-1" /> Mark Ready
                      </Button>
                    )}

                    {/* Edit button for PENDING or READY */}
                    {editable(o.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(o)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}

                    {/* Cancel for PENDING or READY */}
                    {cancellable(o.status) && (
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

      {/* ── Edit dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit order <span className="font-mono text-muted-foreground text-sm">{editing?.id.slice(0, 8)}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as "PENDING" | "READY")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="READY">Ready for pickup</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Set to <strong>Pending</strong> to hold the order, <strong>Ready</strong> to make it available to couriers.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-time">Due time</Label>
              <Input
                id="due-time"
                type="datetime-local"
                value={editDueTime}
                onChange={(e) => setEditDueTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Extend this if you need more preparation time.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editDueTime}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
