"use server";

import { createServerFn } from "@tanstack/react-start";

const DEMO_USERS = [
  { email: "admin@example.com", password: "admin123", name: "System Admin", role: "ADMIN" as const },
  { email: "merchant@example.com", password: "merchant123", name: "Demo Merchant", role: "MERCHANT" as const },
  { email: "courier@example.com", password: "courier123", name: "Demo Courier", role: "COURIER" as const },
];

export const seedDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Array<{ email: string; status: string }> = [];

  // Fetch all users once before the loop to avoid N+1 listUsers calls
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

  for (const u of DEMO_USERS) {
    const existing = userList?.users.find((x) => x.email === u.email);
    let userId = existing?.id;
    if (!existing) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) {
        results.push({ email: u.email, status: `error: ${error.message}` });
        continue;
      }
      userId = data.user.id;
    }
    if (userId) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" },
      );
      results.push({ email: u.email, status: existing ? "exists" : "created" });
    }
  }
  return { results };
});

export const autoSeedIfEmpty = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Fetch users once — reused both for the empty check and for the seed loop
  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.error("Error listing users for auto-seed check:", listError);
    return { status: "error", message: listError.message };
  }

  const { count: rolesCount, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true });

  if (rolesError) {
    console.error("Error checking user_roles count:", rolesError);
  }

  const isAuthEmpty = !list?.users || list.users.length === 0;
  const isRolesEmpty = rolesCount === 0;

  if (isAuthEmpty || isRolesEmpty) {
    console.log(`Auto-seeding triggered: isAuthEmpty=${isAuthEmpty}, isRolesEmpty=${isRolesEmpty}`);
    const results: Array<{ email: string; status: string }> = [];

    for (const u of DEMO_USERS) {
      // Reuse the already-fetched user list — no extra listUsers calls inside the loop
      const existing = list?.users.find((x) => x.email === u.email);
      let userId = existing?.id;

      if (!existing) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error) {
          results.push({ email: u.email, status: `error: ${error.message}` });
          continue;
        }
        userId = data.user.id;
      }

      if (userId) {
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, role: u.role },
          { onConflict: "user_id,role" },
        );
        results.push({ email: u.email, status: existing ? "exists" : "created" });
      }
    }
    return { status: "seeded", results };
  }

  return { status: "skipped", message: "Users and roles tables are not empty" };
});
