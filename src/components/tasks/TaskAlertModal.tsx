import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember } from '@/types/tasks'
import { isOverdue, isForgotten, progressColor } from '@/lib/taskUtils'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  tasks: Task[]
  currentUser: TeamMember | null
  isManager: boolean
}

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  bloqueado: 'Bloqueado',
  feito: 'Feito',
}

export function TaskAlertModal({ open, onClose, tasks, currentUser, isManager }: Props) {
  const navigate = useNavigate()

  if (!currentUser) return null

  // Filter relevant tasks: overdue, forgotten, or blocked
  const alertTasks = tasks.filter(t => {
    if (t.status === 'feito') return false
    return isOverdue(t.due_date) || isForgotten(t.updated_at) || t.status === 'bloqueado'
  })

  // Group by assignee for manager view
  const grouped = isManager
    ? alertTasks.reduce<Record<string, Task[]>>((acc, t) => {
        t.assignee_names.forEach((name, i) => {
          const key = name || 'Sem responsável'
          if (!acc[key]) acc[key] = []
          if (!acc[key].find(x => x.id === t.id)) acc[key].push(t)
        })
        return acc
      }, {})
    : { 'Minhas tarefas': alertTasks }

  const handleViewAll = () => {
    onClose()
    navigate('/tarefas?periodo=vencidas')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#004A30] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#C0392B]" />
            Alertas de Tarefas
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {alertTasks.length === 0 ? (
            <p className="text-center py-8 text-[#2C2C2A]/50">
              🎉 Nenhuma tarefa com alerta no momento!
            </p>
          ) : (
            Object.entries(grouped).map(([person, personTasks]) => (
              <div key={person} className="mb-4">
                {isManager && (
                  <h3 className="text-sm font-semibold text-[#004A30] mb-2 border-b border-[#004A30]/10 pb-1">
                    {person}
                  </h3>
                )}
                <div className="space-y-2">
                  {personTasks.map(task => {
                    const overdue = isOverdue(task.due_date)
                    const forgotten = isForgotten(task.updated_at) && task.status !== 'feito'
                    const pColor = progressColor(task.progress)

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'p-3 rounded-lg border text-sm',
                          overdue && 'bg-red-50 border-l-4 border-l-[#C0392B]',
                          forgotten && !overdue && 'bg-orange-50 border-l-4 border-l-[#F39C12]',
                          !overdue && !forgotten && 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-[#2C2C2A]">{task.title}</p>
                            <p className="text-xs text-[#2C2C2A]/50 mt-0.5">
                              {task.assignee_names.join(', ')}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {task.status === 'bloqueado' && (
                              <Badge className="bg-[#C0392B] text-white text-[10px]">Bloqueado</Badge>
                            )}
                            {overdue && (
                              <Badge className="bg-[#C0392B] text-white text-[10px]">Vencida</Badge>
                            )}
                            {forgotten && !overdue && (
                              <Badge className="bg-[#F39C12] text-white text-[10px]">Esquecida</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#2C2C2A]/60">
                              {statusLabels[task.status]}
                            </span>
                            <span className="text-xs text-[#2C2C2A]/60">
                              {task.progress}%
                            </span>
                          </div>
                          <span className={cn(
                            'text-xs',
                            overdue ? 'text-[#C0392B] font-bold' : 'text-[#2C2C2A]/60'
                          )}>
                            {format(parseISO(task.due_date), 'dd/MM/yyyy')}
                          </span>
                        </div>

                        {/* Mini progress bar */}
                        <div className="h-1.5 w-full rounded-full bg-gray-200 mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${task.progress}%`, backgroundColor: pColor }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            onClick={handleViewAll}
            className="bg-[#004A30] hover:bg-[#004A30]/90 text-white"
          >
            Ver todas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
