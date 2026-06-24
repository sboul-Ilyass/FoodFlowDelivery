import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { adminListUsers } from "@/lib/admin.functions";
import { useAuth, roleHome } from "@/lib/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

interface ProductForm {
  name: string;
  description: string;
  price: string;
  image_url: string;
  available: boolean;
  merchant_id: string;
}

const EMPTY_FORM: ProductForm = {
  name: "", description: "", price: "", image_url: "", available: true, merchant_id: "",
};

function AdminProducts() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);

  useEffect(() => {
    if (!auth.loading && auth.role !== "ADMIN") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const merchants = (users ?? []).filter((u) => u.role === "MERCHANT");

  const { data: products } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,price,available,image_url,merchant_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const merchantIds = [...new Set(data.map((p) => p.merchant_id))];
      const { data: pRows } = await supabase.from("profiles").select("id,name").in("id", merchantIds);
      const nameMap = new Map((pRows ?? []).map((r) => [r.id, r.name]));
      return data.map((p) => ({ ...p, merchantName: nameMap.get(p.merchant_id) ?? "—" }));
    },
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, merchant_id: merchants[0]?.id ?? "" });
    setEditingId(null);
    setDialog("create");
  };

  const openEdit = (p: any) => {
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      image_url: p.image_url ?? "",
      available: p.available,
      merchant_id: p.merchant_id,
    });
    setEditingId(p.id);
    setDialog("edit");
  };

  const save = async () => {
    const price = parseFloat(form.price);
    if (!form.name.trim()) return toast.error("Name is required");
    if (isNaN(price) || price < 0) return toast.error("Enter a valid price");
    if (!form.merchant_id) return toast.error("Select a merchant");
    setSaving(true);
    try {
      if (dialog === "edit" && editingId) {
        const { error } = await supabase.from("products").update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          available: form.available,
          image_url: form.image_url.trim() || null,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase.from("products").insert({
          merchant_id: form.merchant_id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          available: form.available,
          image_url: form.image_url.trim() || null,
        });
        if (error) throw error;
        toast.success("Product created");
      }
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["admin-all-products"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailable = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ available: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-all-products"] });
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-all-products"] });
    }
  };

  return (
    <AppShell title="Products">
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Package className="h-4 w-4" />
            {products?.length ?? 0} product{products?.length !== 1 ? "s" : ""}
          </div>
          <Button onClick={openCreate} disabled={merchants.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> New product
          </Button>
        </div>
        {merchants.length === 0 && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
            Create a Merchant user first before adding products.
          </p>
        )}

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                        : <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      }
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.merchantName}</td>
                  <td className="px-4 py-3 font-semibold">€{Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={p.available}
                      onCheckedChange={() => toggleAvailable(p.id, p.available)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{p.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cannot be undone. Existing orders referencing this product will remain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProduct(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
              {products?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">
                    No products yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {dialog === "create" && (
              <Field label="Merchant">
                <Select value={form.merchant_id} onValueChange={(v) => setForm((f) => ({ ...f, merchant_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select merchant" /></SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Margherita Pizza" />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description (optional)" />
            </Field>
            <Field label="Price (€) *">
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Image URL">
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <Switch id="prod-avail" checked={form.available} onCheckedChange={(v) => setForm((f) => ({ ...f, available: v }))} />
              <Label htmlFor="prod-avail">Available to customers</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : dialog === "edit" ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
