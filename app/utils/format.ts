const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60]
]

/** "il y a 3 jours", "hier", "à l’instant"… */
export function formatRelative(date: string | Date) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000

  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit)
    }
  }

  return 'à l’instant'
}
