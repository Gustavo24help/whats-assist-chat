import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, userId, email, password, fullName, role } = await req.json()

    console.log('Manage users action:', action, { userId, email, role })

    switch (action) {
      case 'check_admin':
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
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

        // Add role
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
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
        if (deleteError) throw deleteError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'update_role':
        // Delete old roles
        await supabase.from('user_roles').delete().eq('user_id', userId)
        
        // Add new role
        const { error: updateRoleError } = await supabase.from('user_roles').insert({
          user_id: userId,
          role
        })

        if (updateRoleError) throw updateRoleError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'reset_password':
        const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
          password
        })

        if (resetError) throw resetError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'list':
        // Get all auth users
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw listError

        // Get profiles and roles for each user
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
