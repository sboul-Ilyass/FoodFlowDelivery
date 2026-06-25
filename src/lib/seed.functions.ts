"use server";

import { createServerFn } from "@tanstack/react-start";

const DEMO_USERS = [
  { email: "admin@example.com",    password: "admin123",    name: "System Admin",  role: "ADMIN"    as const },
  { email: "merchant@example.com", password: "merchant123", name: "Demo Merchant", role: "MERCHANT" as const },
  { email: "courier@example.com",  password: "courier123",  name: "Demo Courier",  role: "COURIER"  as const },
  { email: "customer@example.com", password: "customer123", name: "Demo Customer", role: "CUSTOMER" as const },
];

const DEMO_PRODUCTS = [
  { name: "Margherita Pizza",  description: "Classic tomato & mozzarella",                  price: 12.90 },
  { name: "Veggie Burger",     description: "Grilled veggie patty with fresh toppings",     price: 10.50 },
  { name: "Caesar Salad",      description: "Romaine, croutons, parmesan, caesar dressing", price:  9.00 },
  { name: "Beef Tacos (x3)",   description: "Seasoned beef, pico de gallo, lime crema",     price: 11.00 },
  { name: "Chocolate Fondant", description: "Warm chocolate cake with vanilla ice cream",   price:  7.50 },
];

export const seedDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Array<{ email: string; status: string }> = [];

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

  // Track the merchant ID regardless of whether they existed or were just created
  let merchantId: string | undefined;

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
      if (u.email === "merchant@example.com") merchantId = userId;
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" },
      );
      results.push({ email: u.email, status: existing ? "exists" : "created" });
    }
  }

  // Seed products using the tracked merchant ID (works even when merchant was just created)
  const { count: productCount } = await supabaseAdmin
    .from("products")
    .select("*", { count: "exact", head: true });

  if (productCount === 0 && merchantId) {
    await supabaseAdmin.from("products").insert(
      DEMO_PRODUCTS.map((p) => ({ ...p, merchant_id: merchantId })),
    );
  }

  return { results };
});

export const autoSeedIfEmpty = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.error("Auto-seed: error listing users:", listError);
    return { status: "error", message: listError.message };
  }

  const { count: rolesCount, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true });

  if (rolesError) console.error("Auto-seed: error checking user_roles:", rolesError);

  const isAuthEmpty  = !list?.users || list.users.length === 0;
  const isRolesEmpty = rolesCount === 0;

  if (!isAuthEmpty && !isRolesEmpty) {
    return { status: "skipped", message: "Users and roles tables are not empty" };
  }

  console.log(`Auto-seeding triggered: isAuthEmpty=${isAuthEmpty}, isRolesEmpty=${isRolesEmpty}`);
  const results: Array<{ email: string; status: string }> = [];

  // Track the merchant ID regardless of whether they existed or were just created
  let merchantId: string | undefined;

  for (const u of DEMO_USERS) {
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
      if (u.email === "merchant@example.com") merchantId = userId;
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" },
      );
      results.push({ email: u.email, status: existing ? "exists" : "created" });
    }
  }

  // Seed products using the tracked merchant ID (works even when merchant was just created)
  const { count: productCount } = await supabaseAdmin
    .from("products")
    .select("*", { count: "exact", head: true });

  if (productCount === 0 && merchantId) {
    await supabaseAdmin.from("products").insert(
      DEMO_PRODUCTS.map((p) => ({ ...p, merchant_id: merchantId })),
    );
  }

  return { status: "seeded", results };
});
