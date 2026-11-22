import type { PublicSeatInfo } from '~~/shared/tarot'
import { salonCharacterById } from '~~/shared/play/salonCharacters'

/** Portrait of a seat: the bot's salon character, the person's account photo, or their initials. */
export function seatAvatar(seat: Pick<PublicSeatInfo, 'name' | 'picture' | 'character'> | null | undefined) {
  const name = seat?.name?.trim() || '?'
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
  if (seat?.character && salonCharacterById(seat.character)) {
    return { src: `/play/avatars/${seat.character}.webp`, initials }
  }
  return { src: seat?.picture || null, initials }
}
