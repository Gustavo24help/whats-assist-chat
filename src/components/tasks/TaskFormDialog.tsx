import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Task, TeamMember, Status, Priority } from '@/types/tasks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  team: TeamMember[]
  currentMember: TeamMember
  isManager: boolean
  onSaved: () => void
}

export function TaskFormDialog({ open, onOpenChange, task, team, currentMember, isManager, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [project, setProject] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<Priority>('media')
  const [status, setStatus] = useState<Status>('pendente')
  const [progress, setProgress] = useState(0)
  const [lastComment, setLastComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title)
        setDescription(task.description || '')
        setProject(task.project || '')
        setAssigneeIds(task.assignee_ids)
        setStartDate(task.start_date ? new Date(task.start_date + 'T00:00:00') : undefined)
        setDueDate(new Date(task.due_date + 'T00:00:00'))
        setPriority(task.priority)
        setStatus(task.status)
        setProgress(task.progress)
        setLastComment(task.last_comment || '')
      } else {
        setTitle('')
        setDescription('')
        setProject('')
        setAssigneeIds(isManager ? [] : [currentMember.id])
        setStartDate(undefined)
        setDueDate(undefined)
        setPriority('media')
        setStatus('pendente')
        setProgress(0)
        setLastComment('')
      }
    }
  }, [open, task, currentMember.id, isManager])

  const toggleAssignee = (id: string) => {
    if (!isManager && id === currentMember.id) return
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return }
    if (!dueDate) { toast.error('Data de entrega é obrigatória'); return }
    if (!assigneeIds.length) { toast.error('Selecione ao menos um responsável'); return }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        project: project.trim() || null,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        priority,
        status,
        progress,
        last_comment: lastComment.trim() || null,
      }

      let taskId = task?.id

      if (task) {
        const { error } = await (supabase as any)
          .from('tasks')
          .update(payload)
          .eq('id', task.id)
        if (error) throw error
      } else {
        const { data, error } = await (supabase as any)
          .from('tasks')
          .insert({ ...payload, created_by: currentMember.id })
          .select('id')
          .single()
        if (error) throw error
        taskId = data.id
      }

      // Sync assignees
      await (supabase as any)
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)

      const assigneeRows = assigneeIds.map(uid => ({ task_id: taskId, user_id: uid }))
      const { error: aErr } = await (supabase as any)
        .from('task_assignees')
        .insert(assigneeRows)
      if (aErr) throw aErr

      toast.success(task ? 'Tarefa atualizada!' : 'Tarefa criada!')
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#004A30]">
            {task ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label className="text-[#2C2C2A]">Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da tarefa" />
          </div>

          {/* Description */}
          <div>
            <Label className="text-[#2C2C2A]">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes..." rows={3} />
          </div>

          {/* Project */}
          <div>
            <Label className="text-[#2C2C2A]">Projeto</Label>
            <Input value={project} onChange={e => setProject(e.target.value)} placeholder="Ex: CRM, Marketing" />
          </div>

          {/* Assignees */}
          <div>
            <Label className="text-[#2C2C2A]">Responsável(is) *</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {team.map(m => {
                const selected = assigneeIds.includes(m.id)
                const locked = !isManager && m.id === currentMember.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                      selected
                        ? 'bg-[#004A30] text-white border-[#004A30]'
                        : 'bg-white text-[#2C2C2A] border-gray-300 hover:border-[#004A30]',
                      locked && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    {m.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#2C2C2A]">Data de início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-[#2C2C2A]">Data de entrega *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#2C2C2A]">Prioridade *</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#2C2C2A]">Status *</Label>
              <Select value={status} onValueChange={v => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="feito">Feito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress */}
          <div>
            <Label className="text-[#2C2C2A]">% Concluído: {progress}%</Label>
            <Slider
              value={[progress]}
              onValueChange={v => setProgress(v[0])}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>

          {/* Last comment */}
          <div>
            <Label className="text-[#2C2C2A]">Último comentário</Label>
            <Textarea value={lastComment} onChange={e => setLastComment(e.target.value)} placeholder="Observação..." rows={2} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#004A30] hover:bg-[#004A30]/90 text-white"
          >
            {saving ? 'Salvando...' : task ? 'Salvar alterações' : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
