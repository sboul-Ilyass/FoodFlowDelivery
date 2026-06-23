import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "ADMIN" | "MERCHANT" | "COURIER" | null;

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: Role;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    name: null,
    role: null,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: ures } = await supabase.auth.getUser();
      const user = ures.user;
      if (!user) {
        if (mounted)
          setState({ loading: false, userId: null, email: null, name: null, role: null });
        return;
      }
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("name,email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
      ]);
      if (!mounted) return;
      setState({
        loading: false,
        userId: user.id,
        email: user.email ?? null,
        name: prof?.name ?? user.email ?? null,
        role: (roles?.[0]?.role as Role) ?? null,
      });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function roleHome(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MERCHANT") return "/merchant";
  if (role === "COURIER") return "/courier";
  return "/auth";
}
