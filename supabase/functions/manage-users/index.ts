import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAuthenticatedUser(req: Request, supabaseUrl: string, supabaseAnonKey: string) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid Authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  return { user: data.user, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ===== Authentication: Require valid JWT =====
    const { user: authUser, error: authError } = await getAuthenticatedUser(req, supabaseUrl, supabaseAnonKey);
    if (authError || !authUser) {
      console.warn('[manage-users] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== Authorization: Require admin role =====
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: adminCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .eq('role', 'admin')
      .single();

    const { action, userId, email, password, fullName, role } = await req.json()

    // Only check_admin and list don't require admin role
    const requiresAdmin = !['check_admin'].includes(action);
    if (requiresAdmin && !adminCheck) {
      console.warn(`[manage-users] Non-admin user ${authUser.id} attempted action: ${action}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Manage users action:', action, { userId, email, role, executedBy: authUser.id })

    // Input validation
    if (action === 'create') {
      if (!email || typeof email !== 'string' || email.length > 255) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
        return new Response(JSON.stringify({ error: 'Password must be 6-128 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (fullName && (typeof fullName !== 'string' || fullName.length > 200)) {
        return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    switch (action) {
      case 'check_admin':
        // Users can check their own admin status
        const checkUserId = userId || authUser.id;
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', checkUserId)
          .eq('role', 'admin')
          .single()

        return new Response(
          JSON.stringify({ success: true, isAdmin: !!roleData && !roleError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'create':
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        })

        if (createError) throw createError

        if (newUser.user) {
          await supabase.from('user_roles').insert({
            user_id: newUser.user.id,
            role: role || 'user'
          })
        }

        return new Response(JSON.stringify({ success: true, user: newUser }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'delete':
        if (!userId) throw new Error('userId is required');
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
        if (deleteError) throw deleteError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'update_role':
        if (!userId || !role) throw new Error('userId and role are required');
        await supabase.from('user_roles').delete().eq('user_id', userId)
        
        const { error: updateRoleError } = await supabase.from('user_roles').insert({
          user_id: userId,
          role
        })

        if (updateRoleError) throw updateRoleError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'reset_password':
        if (!userId || !password) throw new Error('userId and password are required');
        const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
          password
        })

        if (resetError) throw resetError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'list':
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw listError

        const usersWithData = await Promise.all(
          users.map(async (user) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .single()

            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .single()

            return {
              id: user.id,
              email: user.email,
              full_name: profile?.full_name || user.user_metadata?.full_name,
              role: roleData?.role || 'user'
            }
          })
        )

        return new Response(JSON.stringify({ success: true, users: usersWithData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    console.error('Error managing users:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
