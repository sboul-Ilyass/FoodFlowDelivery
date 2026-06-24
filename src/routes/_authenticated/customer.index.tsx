import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Store, MapPin, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customer/")({
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!auth.loading && auth.role !== "CUSTOMER") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  const [selected, setSelected] = useState<any>(null);
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);

  // Pre-fill delivery address from profile
  useEffect(() => {
    if (!auth.userId) return;
    supabase
      .from("profiles")
      .select("address")
      .eq("id", auth.userId)
      .maybeSingle()
      .then(({ data }) => { if (data?.address) setAddress(data.address); });
  }, [auth.userId]);

  // Products + merchant names
  const { data: products } = useQuery({
    queryKey: ["available-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,price,merchant_id,image_url")
        .eq("available", true)
        .order("name");
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const merchantIds = [...new Set(data.map((p) => p.merchant_id))];
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", merchantIds);
      const profileMap = new Map((profileRows ?? []).map((r) => [r.id, r.name]));

      return data.map((p) => ({
        ...p,
        merchantName: profileMap.get(p.merchant_id) ?? "Restaurant",
      }));
    },
  });

  // Group by merchant
  const byMerchant = useMemo(() => {
    if (!products) return [];
    const map = new Map<string, { merchantId: string; merchantName: string; items: any[] }>();
    for (const p of products) {
      if (!map.has(p.merchant_id))
        map.set(p.merchant_id, { merchantId: p.merchant_id, merchantName: p.merchantName, items: [] });
      map.get(p.merchant_id)!.items.push(p);
    }
    return [...map.values()];
  }, [products]);

  const placeOrder = async () => {
    if (!address.trim()) return toast.error("Please enter your delivery address");
    if (!selected) return;
    setPlacing(true);
    try {
      await supabase.from("profiles").update({ address: address.trim() }).eq("id", auth.userId!);
      const { error } = await supabase.from("orders").insert({
        merchant_id: selected.merchant_id,
        product_id: selected.id,
        customer_user_id: auth.userId,
        delivery_address: address.trim(),
        due_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: "PENDING",
      });
      if (error) throw error;
      toast.success(`Order placed for ${selected.name}!`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["my-customer-orders", auth.userId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AppShell title="Order Food">
      <div className="space-y-12">

        {/* ── Restaurants & menus ── */}
        <div className="space-y-10">
          {byMerchant.length === 0 && (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No restaurants available right now. Check back soon!
            </div>
          )}

          {byMerchant.map((merchant) => (
            <section key={merchant.merchantId}>
              {/* Restaurant header */}
              <div className="flex items-center gap-3 mb-5 pb-3 border-b">
                <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{merchant.merchantName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {merchant.items.length} item{merchant.items.length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>

              {/* Product grid — 2 / 3 / 4 cols */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {merchant.items.map((p) => (
                  <ProductCard key={p.id} product={p} onOrder={() => setSelected(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>

      </div>

      {/* Order confirmation dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              <span className="text-primary font-semibold">€{selected ? Number(selected.price).toFixed(2) : ""}</span>
              {" · "}{selected?.merchantName}{" · "}~30 min delivery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-addr" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Delivery address *
              </Label>
              <Input
                id="delivery-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, City"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={placeOrder} disabled={placing}>
              {placing ? "Placing…" : "Place order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------
function ProductCard({ product, onOrder }: { product: any; onOrder: () => void }) {
  return (
    <div className="group bg-card border rounded-xl overflow-hidden flex flex-col hover:shadow-lg transition-all duration-200">
      {/* Image */}
      <div className="relative h-40 bg-muted overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
            <UtensilsCrossed className="h-10 w-10 text-orange-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm leading-tight line-clamp-1">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-base text-primary">
            €{Number(product.price).toFixed(2)}
          </span>
          <Button size="sm" className="h-7 text-xs px-3" onClick={onOrder}>
            Order
          </Button>
        </div>
      </div>
    </div>
  );
}
