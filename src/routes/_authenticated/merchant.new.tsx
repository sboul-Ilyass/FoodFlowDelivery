import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Users, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/merchant/new")({
  component: NewOrder,
});

type DestMode = "customer" | "custom";

function NewOrder() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.loading && auth.role !== "MERCHANT") {
      navigate({ to: roleHome(auth.role) });
    }
  }, [auth.loading, auth.role, navigate]);

  const [mode, setMode] = useState<DestMode>("customer");
  const [customerId, setCustomerId] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,address,code")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const canSubmit =
    !!dueTime &&
    (mode === "customer" ? !!customerId : customAddress.trim().length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.userId || !canSubmit) return;
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      merchant_id: auth.userId,
      customer_id:       mode === "customer" ? customerId       : null,
      delivery_address:  mode === "custom"   ? customAddress.trim() : null,
      due_time: new Date(dueTime).toISOString(),
      status: "PENDING",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Order created");
      navigate({ to: "/merchant" });
    }
  };

  return (
    <AppShell title="Create Order">
      <form onSubmit={submit} className="max-w-xl space-y-6">

        {/* Destination type toggle */}
        <div className="space-y-3">
          <Label>Delivery destination</Label>

          {/* Toggle pills */}
          <div className="flex rounded-lg border bg-muted p-1 gap-1">
            {(
              [
                { value: "customer", icon: Users,  label: "Existing customer" },
                { value: "custom",   icon: MapPin, label: "Custom address"    },
              ] as { value: DestMode; icon: typeof Users; label: string }[]
            ).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                  mode === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Predefined customer select */}
          {mode === "customer" && (
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer address" />
              </SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Free-text address */}
          {mode === "custom" && (
            <Input
              placeholder="e.g. 14 Rue de la Paix, Lyon"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Due time */}
        <div className="space-y-1.5">
          <Label htmlFor="due">Required by</Label>
          <Input
            id="due"
            type="datetime-local"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            required
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "Creating…" : "Create order"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/merchant" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
