export const isOverdue = (dueDate: string) =>
  dueDate < new Date().toISOString().split('T')[0]

export const isForgotten = (updatedAt: string) =>
  (Date.now() - new Date(updatedAt).getTime()) / 86_400_000 > 3

export const isDueToday = (dueDate: string) =>
  dueDate === new Date().toISOString().split('T')[0]

export const progressColor = (p: number) =>
  p < 30 ? '#C0392B' : p < 70 ? '#F39C12' : '#004A30'

export const isDueInNextDays = (dueDate: string, days: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diff = (due.getTime() - today.getTime()) / 86_400_000
  return diff >= 0 && diff <= days
}
