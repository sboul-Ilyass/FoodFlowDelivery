import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StatusBadge } from "@/components/AppShell";
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
import { MapPin, Plus, Pencil, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

// ── helpers ──────────────────────────────────────────────────────────────────
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultDueTime(): string {
  return toLocalInput(new Date(Date.now() + 30 * 60_000).toISOString());
}

// ── types ─────────────────────────────────────────────────────────────────────
type Order = {
  id: string;
  due_time: string;
  status: string;
  assigned_courier_id: string | null;
  merchant_id: string;
  customer_user_id: string | null;
  delivery_address: string | null;
  created_at: string;
  customers: { name: string; address: string } | null;
  products: { name: string } | null;
};

// ── component ─────────────────────────────────────────────────────────────────
function AdminOrders() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listCouriers  = useServerFn(adminListCouriers);
  const assignCourier = useServerFn(adminAssignCourier);

  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,due_time,status,assigned_courier_id,merchant_id,customer_user_id,delivery_address,customers(name,address),products(name),created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // All unique user IDs we need profiles for (merchants + couriers + customers)
  const allIds = Array.from(new Set([
    ...(orders ?? []).map((o) => o.merchant_id),
    ...(orders ?? []).map((o) => o.assigned_courier_id).filter(Boolean),
    ...(orders ?? []).map((o) => o.customer_user_id).filter(Boolean),
  ])).filter(Boolean) as string[];

  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-orders", allIds.join(",")],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").in("id", allIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriers(),
  });

  // All merchants (for the create dialog)
  const { data: merchants } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "MERCHANT");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
      return profs ?? [];
    },
  });

  const nameOf = (id?: string | null) =>
    (profiles ?? []).find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  // ── Create dialog state ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [cMerchant, setCMerchant] = useState("");
  const [cProduct, setCProduct]   = useState("");
  const [cAddress, setCAddress]   = useState("");
  const [cDueTime, setCDueTime]   = useState(defaultDueTime);
  const [cStatus, setCStatus]     = useState<string>("PENDING");
  const [creating, setCreating]   = useState(false);

  const { data: merchantProducts } = useQuery({
    queryKey: ["admin-products-for", cMerchant],
    enabled: !!cMerchant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name")
        .eq("merchant_id", cMerchant)
        .eq("available", true);
      if (error) throw error;
      return data;
    },
  });

  const openCreate = () => {
    setCMerchant("");
    setCProduct("");
    setCAddress("");
    setCDueTime(defaultDueTime());
    setCStatus("PENDING");
    setShowCreate(true);
  };

  const createOrder = async () => {
    if (!cMerchant) return toast.error("Select a merchant");
    if (!cDueTime)  return toast.error("Set a due time");
    setCreating(true);
    const { error } = await supabase.from("orders").insert({
      merchant_id:      cMerchant,
      product_id:       cProduct || null,
      delivery_address: cAddress || null,
      due_time:         new Date(cDueTime).toISOString(),
      status:           cStatus,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order created");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    }
  };

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editing, setEditing]       = useState<Order | null>(null);
  const [eDueTime, setEDueTime]     = useState("");
  const [eAddress, setEAddress]     = useState("");
  const [saving, setSaving]         = useState(false);

  const openEdit = (o: Order) => {
    setEditing(o);
    setEDueTime(toLocalInput(o.due_time));
    setEAddress(o.delivery_address ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("orders").update({
      due_time:         new Date(eDueTime).toISOString(),
      delivery_address: eAddress || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    }
  };

  // ── Inline actions ─────────────────────────────────────────────────────────
  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    }
  };

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
      toast.success("Order deleted");
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["profiles-for-orders"] });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Orders">
      <div className="space-y-4 max-w-[1400px]">

        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New order
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned courier</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">

                  {/* ID */}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {o.id.slice(0, 8)}
                  </td>

                  {/* Merchant */}
                  <td className="px-4 py-3 font-medium">{nameOf(o.merchant_id)}</td>

                  {/* Customer (who placed the order) */}
                  <td className="px-4 py-3">
                    {o.customer_user_id ? (
                      <span className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        {nameOf(o.customer_user_id)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  {/* Delivery destination */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {o.customers?.name ? (
                      <>
                        <div className="font-medium truncate">{o.customers.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{o.customers.address}</div>
                      </>
                    ) : o.delivery_address ? (
                      <div className="text-sm flex items-start gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="truncate">{o.delivery_address}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                    {o.products?.name && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {o.products.name}
                      </div>
                    )}
                  </td>

                  {/* Due time */}
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.due_time).toLocaleString()}
                  </td>

                  {/* Status — inline editable */}
                  <td className="px-4 py-3 min-w-[160px]">
                    <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["PENDING", "READY", "IN_DELIVERY", "DELIVERED"].map((s) => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Assigned courier — inline editable + visible name */}
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="space-y-0.5">
                      {o.assigned_courier_id && (
                        <div className="text-xs font-medium text-muted-foreground">
                          {nameOf(o.assigned_courier_id)}
                        </div>
                      )}
                      <Select
                        value={o.assigned_courier_id ?? "none"}
                        onValueChange={(v) => assign(o.id, v === "none" ? null : v)}
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
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openEdit(o)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 text-xs">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the order and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrder(o.id)}>Delete order</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Order dialog ───────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">

            <div className="space-y-1.5">
              <Label>Merchant *</Label>
              <Select value={cMerchant} onValueChange={(v) => { setCMerchant(v); setCProduct(""); }}>
                <SelectTrigger><SelectValue placeholder="Select merchant" /></SelectTrigger>
                <SelectContent>
                  {(merchants ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select
                value={cProduct}
                onValueChange={setCProduct}
                disabled={!cMerchant}
              >
                <SelectTrigger>
                  <SelectValue placeholder={cMerchant ? "Select product (optional)" : "Choose a merchant first"} />
                </SelectTrigger>
                <SelectContent>
                  {(merchantProducts ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-address">Delivery address</Label>
              <Input
                id="c-address"
                value={cAddress}
                onChange={(e) => setCAddress(e.target.value)}
                placeholder="123 Main Street, City"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-due">Due time *</Label>
              <Input
                id="c-due"
                type="datetime-local"
                value={cDueTime}
                onChange={(e) => setCDueTime(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Initial status</Label>
              <Select value={cStatus} onValueChange={setCStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PENDING", "READY"].map((s) => (
                    <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createOrder} disabled={creating}>
              {creating ? "Creating…" : "Create order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Order dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit order{" "}
              <span className="font-mono text-muted-foreground text-sm">{editing?.id.slice(0, 8)}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">

            <div className="space-y-1.5">
              <Label htmlFor="e-due">Due time</Label>
              <Input
                id="e-due"
                type="datetime-local"
                value={eDueTime}
                onChange={(e) => setEDueTime(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-address">Delivery address</Label>
              <Input
                id="e-address"
                value={eAddress}
                onChange={(e) => setEAddress(e.target.value)}
                placeholder="123 Main Street, City"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              To change status or courier, use the inline dropdowns in the table.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !eDueTime}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
