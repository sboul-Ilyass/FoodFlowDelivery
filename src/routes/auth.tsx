import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { autoSeedIfEmpty } from "@/lib/seed.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, roleHome } from "@/lib/useAuth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const autoSeed = useServerFn(autoSeedIfEmpty);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const runAutoSeed = async () => {
      try {
        const res = await autoSeed();
        if (res.status === "seeded") {
          toast.success("Database was empty. Automatically seeded demo accounts!");
        }
      } catch (err) {
        console.error("Auto-seeding check failed:", err);
      }
    };
    runAutoSeed();
  }, [autoSeed]);

  useEffect(() => {
    if (!auth.loading && auth.userId) navigate({ to: roleHome(auth.role) });
  }, [auth, navigate]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Signed in");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-primary text-primary-foreground rounded-xl p-3 mb-3">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">FoodFlow Delivery</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-card rounded-xl border p-6 shadow-sm space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
