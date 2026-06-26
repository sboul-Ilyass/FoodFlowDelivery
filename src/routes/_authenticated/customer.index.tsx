import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Store, UtensilsCrossed, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customer/")({
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.loading && auth.role !== "CUSTOMER") navigate({ to: roleHome(auth.role) });
  }, [auth.loading, auth.role, navigate]);

  // All merchants + their available product counts
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      // Get all merchant user IDs
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "MERCHANT");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];

      // Get their profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,name,address")
        .in("id", ids);

      // Get product counts per merchant
      const { data: products } = await supabase
        .from("products")
        .select("merchant_id")
        .in("merchant_id", ids)
        .eq("available", true);

      const countMap = new Map<string, number>();
      for (const p of products ?? []) {
        countMap.set(p.merchant_id, (countMap.get(p.merchant_id) ?? 0) + 1);
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        itemCount: countMap.get(p.id) ?? 0,
      }));
    },
  });

  return (
    <AppShell title="Restaurants">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a restaurant to browse its menu and place an order.
        </p>

        {restaurants?.length === 0 && (
          <div className="py-20 text-center text-muted-foreground text-sm">
            No restaurants available right now.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(restaurants ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ to: "/customer/restaurant/$merchantId", params: { merchantId: r.id } })}
              className="text-left bg-card border rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-emerald-200 transition-all duration-200 group"
            >
              {/* Icon */}
              <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Store className="h-6 w-6 text-orange-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight truncate">{r.name ?? "Restaurant"}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <UtensilsCrossed className="h-3 w-3" />
                  {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
