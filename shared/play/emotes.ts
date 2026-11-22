/** Quick reactions a player can send to the whole table. */
export const TABLE_EMOTES = ['👍', '👏', '😂', '😮', '😬', '🤔', '🔥', '😢'] as const

export type TableEmote = typeof TABLE_EMOTES[number]

export function isTableEmote(value: unknown): value is TableEmote {
  return typeof value === 'string' && (TABLE_EMOTES as readonly string[]).includes(value)
}

/** One reaction per player at most every this many ms (anti-spam). */
export const EMOTE_COOLDOWN_MS = 1_200

/** Server → clients: a player reacted. */
export type EmoteMessage = { type: 'emote', seat: number, emote: TableEmote }
