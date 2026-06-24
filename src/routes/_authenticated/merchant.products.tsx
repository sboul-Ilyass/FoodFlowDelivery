import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { PlusCircle, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/merchant/products")({
  component: MerchantProducts,
});

interface ProductForm {
  name: string;
  description: string;
  price: string;
  image_url: string;
  available: boolean;
}

const EMPTY_FORM: ProductForm = { name: "", description: "", price: "", image_url: "", available: true };

function MerchantProducts() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!auth.loading && auth.role !== "MERCHANT") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // product id being edited
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["my-products", auth.userId],
    enabled: !!auth.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,price,available,image_url,created_at")
        .eq("merchant_id", auth.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), image_url: p.image_url ?? "", available: p.available });
    setDialogOpen(true);
  };

  const save = async () => {
    const price = parseFloat(form.price);
    if (!form.name.trim()) return toast.error("Name is required");
    if (isNaN(price) || price < 0) return toast.error("Enter a valid price");

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("products")
          .update({ name: form.name.trim(), description: form.description.trim() || null, price, available: form.available, image_url: form.image_url.trim() || null })
          .eq("id", editing);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase.from("products").insert({
          merchant_id: auth.userId!,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          available: form.available,
          image_url: form.image_url.trim() || null,
        });
        if (error) throw error;
        toast.success("Product created");
      }
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["my-products", auth.userId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailable = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ available: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["my-products", auth.userId] });
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["my-products", auth.userId] });
    }
  };

  return (
    <AppShell title="My Products">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {products?.length ?? 0} product{products?.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4 mr-2" /> Add product
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(products ?? []).map((p: any) => (
            <div key={p.id} className="bg-card border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{p.name}</span>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">
                  €{Number(p.price).toFixed(2)}
                </span>
              </div>

              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.available}
                    onCheckedChange={() => toggleAvailable(p.id, p.available)}
                    id={`avail-${p.id}`}
                  />
                  <Label htmlFor={`avail-${p.id}`} className="text-xs cursor-pointer">
                    {p.available ? "Available" : "Hidden"}
                  </Label>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{p.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone. Existing orders linked to this product will remain.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProduct(p.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}

          {products?.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
              No products yet. Click "Add product" to create your first one.
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Name *</Label>
              <Input
                id="pname"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Margherita Pizza"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdesc">Description</Label>
              <Input
                id="pdesc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pprice">Price (€) *</Label>
              <Input
                id="pprice"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pimage">Image URL</Label>
              <Input
                id="pimage"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="pavail"
                checked={form.available}
                onCheckedChange={(v) => setForm((f) => ({ ...f, available: v }))}
              />
              <Label htmlFor="pavail">Available to customers</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
