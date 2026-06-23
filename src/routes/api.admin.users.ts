import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateAdmin(request);
          const data = await request.json();
          
          if (!data.email || !data.password || !data.name || !data.role) {
            return new Response(JSON.stringify({ message: 'Missing required fields' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { name: data.name },
          });
          if (error) {
            return new Response(JSON.stringify({ message: error.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: created.user.id, role: data.role });
            
          if (roleError) {
            return new Response(JSON.stringify({ message: roleError.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          return new Response(JSON.stringify({ id: created.user.id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message || 'Internal Server Error' }), {
            status: e.status || 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
      
      PUT: async ({ request }) => {
        try {
          await authenticateAdmin(request);
          const data = await request.json();
          
          if (!data.id || !data.name || !data.role) {
            return new Response(JSON.stringify({ message: 'Missing required fields' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          // Update profile name
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ name: data.name })
            .eq('id', data.id);
            
          if (profileError) {
            return new Response(JSON.stringify({ message: profileError.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Update role (delete old, insert new)
          await supabaseAdmin.from('user_roles').delete().eq('user_id', data.id);
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: data.id, role: data.role });
            
          if (roleError) {
            return new Response(JSON.stringify({ message: roleError.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Update password if provided
          if (data.password && data.password.length >= 6) {
            const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
              password: data.password,
            });
            if (passError) {
              return new Response(JSON.stringify({ message: passError.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              });
            }
          }
          
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message || 'Internal Server Error' }), {
            status: e.status || 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
      
      DELETE: async ({ request }) => {
        try {
          await authenticateAdmin(request);
          const data = await request.json();
          
          if (!data.id) {
            return new Response(JSON.stringify({ message: 'Missing user ID' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
          if (error) {
            return new Response(JSON.stringify({ message: error.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message || 'Internal Server Error' }), {
            status: e.status || 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }
});

async function authenticateAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized: Missing token');
    err.status = 401;
    throw err;
  }
  const token = authHeader.replace('Bearer ', '');
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const err: any = new Error('Internal Server Error: Supabase configuration missing');
    err.status = 500;
    throw err;
  }
  
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    const err: any = new Error('Unauthorized: Invalid token');
    err.status = 401;
    throw err;
  }
  
  // Verify user role is ADMIN
  const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'ADMIN'
  });
  
  if (roleError || !isAdmin) {
    const err: any = new Error('Forbidden: Admin access only');
    err.status = 403;
    throw err;
  }
  
  return user;
}
