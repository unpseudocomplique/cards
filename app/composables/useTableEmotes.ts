import type { TableEmote } from '~~/shared/play/emotes'

export type ShownEmote = { id: number, seat: number, emote: TableEmote }

/** How long a reaction stays above the player's head. */
export const EMOTE_VISIBLE_MS = 3_000

/** Reactions currently shown at the table, each fading after a few seconds. */
export function useTableEmotes() {
  const emotes = ref<ShownEmote[]>([])
  let seq = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function showEmote(seat: number, emote: TableEmote) {
    const id = ++seq
    // One bubble per player: a new reaction replaces the previous one.
    emotes.value = [...emotes.value.filter(item => item.seat !== seat), { id, seat, emote }]
    const timer = setTimeout(() => {
      timers.delete(timer)
      emotes.value = emotes.value.filter(item => item.id !== id)
    }, EMOTE_VISIBLE_MS)
    timers.add(timer)
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      for (const timer of timers) {
        clearTimeout(timer)
      }
      timers.clear()
    })
  }

  return { emotes, showEmote }
}
