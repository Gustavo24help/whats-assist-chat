import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Task, TeamMember } from '@/types/tasks'

export function useVisibleTasks(currentMember: TeamMember | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeam = async () => {
    // Fetch all profiles as potential team members
    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')

    if (!profiles) return

    // Fetch roles from team_members
    const { data: roles } = await (supabase as any)
      .from('team_members')
      .select('id, role')

    const roleMap = new Map<string, string>((roles ?? []).map((r: any) => [r.id, r.role]))

    const members: TeamMember[] = (profiles as any[])
      .filter((p: any) => p.full_name)
      .map((p: any) => ({
        id: p.id,
        name: p.full_name || 'Sem nome',
        role: (roleMap.get(p.id) as any) ?? 'member',
      }))

    setTeam(members)
  }

  const fetchTasks = useCallback(async () => {
    if (!currentMember) return

    const isManager = currentMember.role === 'manager'

    let taskIds: string[] = []

    if (isManager) {
      // Manager vê todas as tarefas
      const { data: allTasks } = await (supabase as any)
        .from('tasks')
        .select('*')
        .neq('status', 'feito')
        .order('priority')
        .order('due_date')

      const tasksWithAssignees = await enrichWithAssignees(allTasks ?? [])
      setTasks(tasksWithAssignees)
      return
    }

    // Member: busca IDs que pode ver (próprias + autorizadas)
    const { data: visData } = await (supabase as any)
      .from('task_visibility')
      .select('owner_id')
      .eq('viewer_id', currentMember.id)

    const visibleUserIds = [currentMember.id, ...(visData?.map((r: any) => r.owner_id) ?? [])]

    // Busca tarefas onde é responsável ou onde vê por autorização
    const { data: assigneeData } = await (supabase as any)
      .from('task_assignees')
      .select('task_id')
      .in('user_id', visibleUserIds)

    taskIds = [...new Set((assigneeData?.map((r: any) => r.task_id) ?? []) as string[])]
    if (!taskIds.length) {
      setTasks([])
      return
    }

    const { data } = await (supabase as any)
      .from('tasks')
      .select('*')
      .in('id', taskIds)
      .neq('status', 'feito')
      .order('priority')
      .order('due_date')

    const tasksWithAssignees = await enrichWithAssignees(data ?? [])
    setTasks(tasksWithAssignees)
  }, [currentMember?.id, currentMember?.role])

  const enrichWithAssignees = async (rawTasks: any[]): Promise<Task[]> => {
    if (!rawTasks.length) return []

    const taskIds = rawTasks.map((t: any) => t.id)

    const { data: assignees } = await (supabase as any)
      .from('task_assignees')
      .select('task_id, user_id')
      .in('task_id', taskIds)

    // Buscar nomes dos profiles
    const userIds = [...new Set((assignees ?? []).map((a: any) => a.user_id as string))]
    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    const profileMap = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.full_name || 'Sem nome']))

    const assigneeMap = new Map<string, { ids: string[]; names: string[] }>()
    for (const a of (assignees ?? []) as Array<{ task_id: string; user_id: string }>) {
      if (!assigneeMap.has(a.task_id)) {
        assigneeMap.set(a.task_id, { ids: [], names: [] })
      }
      const entry = assigneeMap.get(a.task_id)!
      entry.ids.push(a.user_id)
      entry.names.push(profileMap.get(a.user_id) || 'Sem nome')
    }

    return rawTasks.map((t: any) => ({
      ...t,
      assignee_ids: assigneeMap.get(t.id)?.ids ?? [],
      assignee_names: assigneeMap.get(t.id)?.names ?? [],
    })) as Task[]
  }

  useEffect(() => {
    if (!currentMember) return
    setLoading(true)
    Promise.all([fetchTeam(), fetchTasks()]).finally(() => setLoading(false))
  }, [currentMember?.id, fetchTasks])

  return { tasks, team, loading, refetch: fetchTasks }
}
