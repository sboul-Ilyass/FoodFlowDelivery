import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "password123";
  const testName = "Test User";
  const testRole = "COURIER";

  console.log(`[TEST] Creating user: ${testEmail}`);
  try {
    // 1. Create auth user
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { name: testName },
    });

    if (createError) {
      console.error("[TEST] Error creating auth user:", createError.message);
      return;
    }

    const userId = created.user.id;
    console.log("[TEST] Auth user created successfully with ID:", userId);

    // Wait a brief moment to allow trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Check profiles
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pError) {
      console.error("[TEST] Error checking profiles:", pError.message);
    } else {
      console.log("[TEST] Profiles result:", profile);
    }

    // 3. Insert role
    console.log(`[TEST] Inserting role ${testRole} for user ${userId}`);
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: testRole });

    if (roleError) {
      console.error("[TEST] Error inserting role:", roleError.message);
    } else {
      console.log("[TEST] Role inserted successfully!");
    }

    // 4. Clean up test user
    console.log("[TEST] Cleaning up test user...");
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[TEST] Error deleting user:", deleteError.message);
    } else {
      console.log("[TEST] Cleaned up successfully.");
    }

  } catch (err) {
    console.error("[TEST] Unexpected exception:", err);
  }
}

runTest();
