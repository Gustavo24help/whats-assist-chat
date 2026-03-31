export type Status = 'pendente' | 'em_andamento' | 'bloqueado' | 'feito'
export type Priority = 'alta' | 'media' | 'baixa'
export type Role = 'manager' | 'member'

export interface Task {
  id: string
  title: string
  description?: string
  project?: string
  created_by: string
  start_date?: string
  due_date: string
  created_at: string
  updated_at: string
  completed_at?: string
  status: Status
  progress: number
  priority: Priority
  last_comment?: string
  assignee_ids: string[]
  assignee_names: string[]
}

export interface TeamMember {
  id: string
  name: string
  role: Role
}
