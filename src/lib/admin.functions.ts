"use server";

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "ADMIN" });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,name,email,created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map((p) => ({
      ...p,
      role: roleMap.get(p.id) ?? null,
    }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    console.log("adminCreateUser inputValidator received:", d);
    try {
      const parsed = z
        .object({
          email: z.string().email(),
          password: z.string().min(6),
          name: z.string().min(1),
          role: z.enum(["MERCHANT", "COURIER", "ADMIN"]),
        })
        .parse(d);
      console.log("adminCreateUser inputValidator parsed successfully:", parsed);
      return parsed;
    } catch (err) {
      console.error("adminCreateUser inputValidator error:", err);
      throw err;
    }
  })
  .handler(async ({ data, context }) => {
    console.log("adminCreateUser handler invoked with data:", data);
    try {
      await assertAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name },
      });
      if (error) {
        console.error("Supabase createUser error:", error);
        throw new Error(error.message);
      }
      console.log("Supabase user created successfully:", created.user.id);
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
      if (roleError) {
        console.error("Supabase insert role error:", roleError);
        throw new Error(roleError.message);
      }
      console.log("Supabase role inserted successfully for user:", created.user.id);
      return { id: created.user.id };
    } catch (e: any) {
      console.error("adminCreateUser exception:", e);
      throw e;
    }
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    console.log("adminUpdateUser inputValidator received:", d);
    try {
      const parsed = z
        .object({
          id: z.string().uuid(),
          name: z.string().min(1),
          role: z.enum(["MERCHANT", "COURIER", "ADMIN"]),
          password: z.string().min(6).optional().or(z.literal("")),
        })
        .parse(d);
      console.log("adminUpdateUser inputValidator parsed successfully:", parsed);
      return parsed;
    } catch (err) {
      console.error("adminUpdateUser inputValidator error:", err);
      throw err;
    }
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ name: data.name }).eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    if (data.password && data.password.length >= 6) {
      await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    console.log("adminDeleteUser inputValidator received:", d);
    try {
      const parsed = z.object({ id: z.string().uuid() }).parse(d);
      console.log("adminDeleteUser inputValidator parsed successfully:", parsed);
      return parsed;
    } catch (err) {
      console.error("adminDeleteUser inputValidator error:", err);
      throw err;
    }
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAssignCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    console.log("adminAssignCourier inputValidator received:", d);
    try {
      const parsed = z.object({ orderId: z.string().uuid(), courierId: z.string().uuid().nullable() }).parse(d);
      console.log("adminAssignCourier inputValidator parsed successfully:", parsed);
      return parsed;
    } catch (err) {
      console.error("adminAssignCourier inputValidator error:", err);
      throw err;
    }
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.courierId ? "ASSIGNED" : "PENDING";
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ assigned_courier_id: data.courierId, status })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCouriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "COURIER");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,name,email")
      .in("id", ids);
    return profiles ?? [];
  });
