import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, roleHome } from "@/lib/useAuth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.userId) navigate({ to: "/auth" });
    else navigate({ to: roleHome(auth.role) });
  }, [auth, navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      Loading…
    </div>
  );
}
