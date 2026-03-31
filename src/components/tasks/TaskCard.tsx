import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Task } from '@/types/tasks'
import { isOverdue, isForgotten, progressColor } from '@/lib/taskUtils'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TaskCardProps {
  task: Task
  onClick: () => void
  canEdit: boolean
}

const priorityConfig = {
  alta: { label: 'Alta', bg: 'bg-[#C0392B]', text: 'text-white' },
  media: { label: 'Média', bg: 'bg-[#F39C12]', text: 'text-white' },
  baixa: { label: 'Baixa', bg: 'bg-gray-400', text: 'text-white' },
}

const statusConfig = {
  pendente: { label: 'Pendente', bg: 'bg-gray-400', text: 'text-white' },
  em_andamento: { label: 'Em andamento', bg: 'bg-blue-500', text: 'text-white' },
  bloqueado: { label: 'Bloqueado', bg: 'bg-[#C0392B]', text: 'text-white' },
  feito: { label: 'Feito', bg: 'bg-[#004A30]', text: 'text-white' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function TaskCard({ task, onClick, canEdit }: TaskCardProps) {
  const overdue = isOverdue(task.due_date)
  const forgotten = isForgotten(task.updated_at) && task.status !== 'feito'
  const pColor = progressColor(task.progress)
  const pCfg = priorityConfig[task.priority]
  const sCfg = statusConfig[task.status]

  return (
    <Card
      onClick={canEdit ? onClick : undefined}
      className={cn(
        'relative p-4 bg-white border transition-shadow',
        canEdit && 'cursor-pointer hover:shadow-md',
        overdue && 'border-l-4 border-l-[#C0392B]',
        forgotten && !overdue && 'border-l-4 border-l-[#F39C12]'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-[#2C2C2A] text-sm leading-tight flex-1">{task.title}</h3>
        <div className="flex gap-1 shrink-0">
          <Badge className={cn('text-[10px] px-1.5 py-0.5', pCfg.bg, pCfg.text)}>{pCfg.label}</Badge>
          <Badge className={cn('text-[10px] px-1.5 py-0.5', sCfg.bg, sCfg.text)}>{sCfg.label}</Badge>
        </div>
      </div>

      {/* Assignees */}
      <div className="flex items-center gap-1 mb-2">
        {task.assignee_names.map((name, i) => (
          <div
            key={task.assignee_ids[i]}
            className="w-7 h-7 rounded-full bg-[#004A30] text-white flex items-center justify-center text-[10px] font-bold"
            title={name}
          >
            {getInitials(name)}
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-[#2C2C2A]/60 mb-1">
          <span>Progresso</span>
          <span>{task.progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${task.progress}%`, backgroundColor: pColor }}
          />
        </div>
      </div>

      {/* Due date */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs',
            overdue ? 'text-[#C0392B] font-bold' : 'text-[#2C2C2A]/60'
          )}
        >
          {overdue ? '⚠ ' : ''}Entrega: {format(parseISO(task.due_date), 'dd/MM/yyyy')}
        </span>
        {task.project && (
          <span className="text-[10px] bg-[#004A30]/10 text-[#004A30] px-1.5 py-0.5 rounded">
            {task.project}
          </span>
        )}
      </div>

      {/* Last comment */}
      {task.last_comment && (
        <p className="text-xs italic text-gray-400 mt-2 line-clamp-1">
          "{task.last_comment}"
        </p>
      )}
    </Card>
  )
}
