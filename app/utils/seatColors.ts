/** One colour per seat, shared by the name tags and the trick cards. */
export const SEAT_COLORS = ['#fcd34d', '#7dd3fc', '#f9a8d4', '#86efac', '#c4b5fd'] as const

export function seatColor(seat: number): string {
  return SEAT_COLORS[seat % SEAT_COLORS.length]!
}
