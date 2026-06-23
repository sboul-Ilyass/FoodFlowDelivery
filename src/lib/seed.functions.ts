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

  for (const u of DEMO_USERS) {
    // Find existing
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
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
  return { results };
});

export const autoSeedIfEmpty = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // List users to check if the table is empty
  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listError) {
    console.error("Error listing users for auto-seed check:", listError);
    return { status: "error", message: listError.message };
  }

  // Check if user_roles is empty
  const { count: rolesCount, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true });
  
  if (rolesError) {
    console.error("Error checking user_roles count:", rolesError);
  }

  const isAuthEmpty = !list?.users || list.users.length === 0;
  const isRolesEmpty = rolesCount === 0;

  // If there are no users, OR there are no roles assigned to any user, run the seeding to ensure everything is set up
  if (isAuthEmpty || isRolesEmpty) {
    console.log(`Auto-seeding triggered: isAuthEmpty=${isAuthEmpty}, isRolesEmpty=${isRolesEmpty}`);
    const results: Array<{ email: string; status: string }> = [];

    for (const u of DEMO_USERS) {
      // Find existing
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
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
    return { status: "seeded", results };
  }

  return { status: "skipped", message: "Users and roles tables are not empty" };
});


