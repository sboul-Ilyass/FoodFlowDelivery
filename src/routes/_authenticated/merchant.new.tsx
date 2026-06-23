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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/merchant/new")({
  component: NewOrder,
});

function NewOrder() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState("");

  // Redirect non-merchants to their correct home
  useEffect(() => {
    if (!auth.loading && auth.role !== "MERCHANT") {
      navigate({ to: roleHome(auth.role) });
    }
  }, [auth.loading, auth.role, navigate]);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.userId || !customerId || !dueTime) return;
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      merchant_id: auth.userId,
      customer_id: customerId,
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
      <form onSubmit={submit} className="max-w-xl bg-card border rounded-lg p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Customer destination</Label>
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due">Required due time</Label>
          <Input
            id="due"
            type="datetime-local"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !customerId || !dueTime}>
            Create order
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/merchant" })}>
            Cancel
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
