import { useEffect, useState } from 'react'
import type { Task, TeamMember } from '@/types/tasks'

export function useTaskAlert(tasks: Task[], currentUser: TeamMember | null) {
  const [showPopup, setShowPopup] = useState(false)

  const hasOverdue = tasks.some(t =>
    t.due_date < new Date().toISOString().split('T')[0]
  )

  const checkTime = () => {
    const h = new Date().getHours()
    const m = new Date().getMinutes()
    const inWindow = (target: number) => h === target && m <= 5

    if (hasOverdue) { setShowPopup(true); return }

    if (inWindow(9) && !sessionStorage.getItem('alert_9')) {
      sessionStorage.setItem('alert_9', '1')
      setShowPopup(true)
    }
    if (inWindow(14) && !sessionStorage.getItem('alert_14')) {
      sessionStorage.setItem('alert_14', '1')
      setShowPopup(true)
    }
    if (h >= 9 && !sessionStorage.getItem('alert_9')) {
      sessionStorage.setItem('alert_9', '1')
      setShowPopup(true)
    }
  }

  useEffect(() => {
    if (!currentUser || !tasks.length) return
    checkTime()
    const interval = setInterval(checkTime, 60_000)

    const now = new Date()
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const timer = setTimeout(() => {
      sessionStorage.removeItem('alert_9')
      sessionStorage.removeItem('alert_14')
    }, midnight.getTime() - now.getTime())

    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [tasks, currentUser])

  return { showPopup, setShowPopup }
}
