import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTaskAuth } from '@/hooks/useTaskAuth'
import { useVisibleTasks } from '@/hooks/useVisibleTasks'
import { useTaskAlert } from '@/hooks/useTaskAlert'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog'
import { TaskAlertModal } from '@/components/tasks/TaskAlertModal'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Plus, Loader2, Settings2 } from 'lucide-react'
import { isOverdue, isForgotten, isDueToday, isDueInNextDays } from '@/lib/taskUtils'
import type { Task, Status, Priority, TaskCategory } from '@/types/tasks'
import { PageLayout } from '@/components/PageLayout'

export default function Tarefas() {
  const { currentMember, isManager, loading: authLoading } = useTaskAuth()
  const { tasks, team, loading: tasksLoading, refetch } = useVisibleTasks(currentMember)
  const { showPopup, setShowPopup } = useTaskAlert(tasks, currentMember)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Filters
  const [statusFilter, setStatusFilter] = useState<'todos' | Status>('todos')
  const [priorityFilter, setPriorityFilter] = useState<'todas' | Priority>('todas')
  const [projectFilter, setProjectFilter] = useState('todos')
  const [periodFilter, setPeriodFilter] = useState(() => searchParams.get('periodo') || 'todas')
  const [forgottenOnly, setForgottenOnly] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todos')

  // Dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const projects = useMemo(() => {
    const set = new Set(tasks.map(t => t.project).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [tasks])

  const filtered = useMemo(() => {
    let result = [...tasks]

    if (statusFilter !== 'todos') result = result.filter(t => t.status === statusFilter)
    if (priorityFilter !== 'todas') result = result.filter(t => t.priority === priorityFilter)
    if (projectFilter !== 'todos') result = result.filter(t => t.project === projectFilter)
    if (forgottenOnly) result = result.filter(t => isForgotten(t.updated_at) && t.status !== 'feito')

    if (periodFilter === 'vencidas') result = result.filter(t => isOverdue(t.due_date))
    else if (periodFilter === 'hoje') result = result.filter(t => isDueToday(t.due_date))
    else if (periodFilter === '7dias') result = result.filter(t => isDueInNextDays(t.due_date, 7))

    if (isManager && assigneeFilter !== 'todos') {
      result = result.filter(t => t.assignee_ids.includes(assigneeFilter))
    }
    if (categoryFilter !== 'todos') result = result.filter(t => t.category === categoryFilter)

    return result
  }, [tasks, statusFilter, priorityFilter, projectFilter, periodFilter, forgottenOnly, assigneeFilter, isManager, categoryFilter])

  const loading = authLoading || tasksLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F5F0E8]">
        <Loader2 className="h-8 w-8 animate-spin text-[#004A30]" />
      </div>
    )
  }

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F5F0E8]">
        <p className="text-[#2C2C2A]">Sem permissão para acessar tarefas.</p>
      </div>
    )
  }

  const canEdit = (task: Task) =>
    isManager || task.assignee_ids.includes(currentMember.id)

  return (
    <PageLayout>
      <div className="p-4 md:p-6 overflow-auto flex-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#004A30]">Tarefas</h1>
          <p className="text-sm text-[#2C2C2A]/60">{filtered.length} tarefa(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {!isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/visibility')}
              className="text-[#004A30] border-[#004A30]/30"
            >
              <Settings2 className="h-4 w-4 mr-1" /> Visibilidade
            </Button>
          )}
          <Button
            onClick={() => { setEditingTask(null); setFormOpen(true) }}
            className="bg-[#004A30] hover:bg-[#004A30]/90 text-white"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova tarefa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="min-w-[140px]">
          <Label className="text-xs text-[#2C2C2A]/60 mb-1 block">Status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Label className="text-xs text-[#2C2C2A]/60 mb-1 block">Prioridade</Label>
          <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as any)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Label className="text-xs text-[#2C2C2A]/60 mb-1 block">Projeto</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Label className="text-xs text-[#2C2C2A]/60 mb-1 block">Período</Label>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="vencidas">Vencidas</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Próximos 7 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={forgottenOnly} onCheckedChange={setForgottenOnly} />
            <Label className="text-xs text-[#2C2C2A]/60">Esquecidas</Label>
          </div>
        </div>

        {isManager && (
          <div className="min-w-[160px]">
            <Label className="text-xs text-[#2C2C2A]/60 mb-1 block">Responsável</Label>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {team.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Task grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#2C2C2A]/40">
          <p className="text-lg">Nenhuma tarefa encontrada</p>
          <p className="text-sm mt-1">Ajuste os filtros ou crie uma nova tarefa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              canEdit={canEdit(task)}
              onClick={() => { setEditingTask(task); setFormOpen(true) }}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        team={team}
        currentMember={currentMember}
        isManager={isManager}
        onSaved={refetch}
      />

      {/* Alert modal */}
      <TaskAlertModal
        open={showPopup}
        onClose={() => setShowPopup(false)}
        tasks={tasks}
        currentUser={currentMember}
        isManager={isManager}
      />
      </div>
    </PageLayout>
  )
}
