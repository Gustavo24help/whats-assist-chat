import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { TeamMember, Role } from '@/types/tasks'

export function useTaskAuth() {
  const { user, userProfile } = useAuth()
  const [currentMember, setCurrentMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setCurrentMember(null)
      setLoading(false)
      return
    }

    const fetchRole = async () => {
      const { data } = await (supabase as any)
        .from('team_members')
        .select('role')
        .eq('id', user.id)
        .single()

      setCurrentMember({
        id: user.id,
        name: userProfile?.fullName || user.email || '',
        role: (data?.role as Role) ?? 'member',
      })
      setLoading(false)
    }

    fetchRole()
  }, [user?.id, userProfile?.fullName])

  const isManager = currentMember?.role === 'manager'
  return { currentMember, isManager, loading }
}
