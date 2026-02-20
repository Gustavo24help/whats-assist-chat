/**
 * Brazilian business days calendar for 2026
 * Includes national holidays + Curitiba municipal holidays
 */

// All non-business dates (holidays that fall on weekdays)
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Confraternização Universal',
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-02-18': 'Quarta de Cinzas',
  '2026-04-03': 'Paixão de Cristo',
  '2026-04-21': 'Tiradentes',
  '2026-05-01': 'Dia do Trabalho',
  '2026-06-04': 'Corpus Christi',
  '2026-09-07': 'Independência do Brasil',
  '2026-09-08': 'Nossa Senhora da Luz dos Pinhais',
  '2026-10-12': 'Nossa Senhora Aparecida',
  '2026-11-02': 'Finados',
  '2026-11-20': 'Dia Nacional de Zumbi e da Consciência Negra',
  '2026-12-25': 'Natal',
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Check if a date is a business day (not weekend, not holiday) */
export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // weekend
  return !HOLIDAYS_2026[formatDateKey(d)];
}

/** Get all business days in a date range (inclusive) */
export function getBusinessDaysInRange(from: Date, to: Date): Date[] {
  const result: Date[] = [];
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    if (isBusinessDay(current)) {
      result.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
}

/** Count business days from start of month up to (and including) a given date */
export function countBusinessDaysUpTo(date: Date): number {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return getBusinessDaysInRange(start, date).length;
}

/**
 * Given a month (year, month), find the date of the Nth business day.
 * Returns null if the month doesn't have that many business days.
 */
export function getNthBusinessDay(year: number, month: number, n: number): Date | null {
  const start = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const bDays = getBusinessDaysInRange(start, endOfMonth);
  if (n > bDays.length || n < 1) return null;
  return bDays[n - 1];
}

/**
 * Get all dates in a month that fall on a specific weekday (0=Sun, 1=Mon, ..., 6=Sat)
 */
export function getDatesForWeekday(year: number, month: number, weekday: number): Date[] {
  const result: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === weekday) {
      result.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/** Get the weekday name in Portuguese */
export function getWeekdayName(dow: number): string {
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return names[dow] || '';
}

export { HOLIDAYS_2026 };
