import type { Ref } from 'vue'
import type { PrivateGameView, PublicGameView } from '~~/shared/tarot'
import type { ShownEmote } from '~/composables/useTableEmotes'

/** The finished trick stays on the felt this long before the table moves on. */
const TRICK_ON_SHOW_MS = 2_400
const TURN_PHASES = new Set(['Cutting', 'Bidding', 'ReadyToPlay', 'Trick'])

/**
 * What the table sounds like outside the trick itself (the card and trick
 * sounds are played by the board, in time with the animations): your turn,
 * the cut and the deal, bids, the dog, reactions and the end of a deal.
 */
export function useTableSoundCues(options: {
  publicState: Ref<PublicGameView | null>
  privateState: Ref<PrivateGameView | null>
  emotes: Ref<ShownEmote[]>
}) {
  const { publicState, privateState, emotes } = options
  const sound = useTableSound()
  sound.install()

  const localSeat = computed(() => privateState.value?.seat ?? null)

  /*
   * Arriving at (or coming back to) a table in progress is not news: only
   * changes after the first state are heard.
   */
  let primed = false
  watch(() => Boolean(publicState.value), (present) => {
    if (present && !primed) {
      setTimeout(() => {
        primed = true
      }, 0)
    }
  }, { immediate: true })

  /* Your turn: when it comes to you, and again when you lead after a trick. */
  let turnTimer: ReturnType<typeof setTimeout> | undefined
  const turnKey = computed(() => {
    const state = publicState.value
    if (!state || localSeat.value === null || state.currentSeat !== localSeat.value || !TURN_PHASES.has(state.phase)) {
      return null
    }
    return `${state.dealIndex}:${state.phase}:${privateState.value?.hand.length ?? 0}`
  })
  watch(turnKey, (key, previous) => {
    clearTimeout(turnTimer)
    if (!key || key === previous) {
      return
    }
    const state = publicState.value!
    // Leading after a trick: wait until the finished trick has been swept away.
    const wait = state.phase === 'Trick' && state.trick.length === 0 && state.lastTrick?.length ? TRICK_ON_SHOW_MS : 0
    turnTimer = setTimeout(() => {
      if (turnKey.value !== key) {
        return
      }
      sound.play('turn')
      sound.vibrate('turn')
    }, wait)
  })

  /* The cut, then the cards dealt. */
  watch(() => {
    const cut = publicState.value?.lastCut
    return cut ? `${publicState.value?.dealIndex}:${cut.seat}:${cut.at}` : null
  }, (key, previous) => {
    if (!primed || !key || key === previous) {
      return
    }
    sound.play('cut')
    sound.play('deal', 0.6)
    if (publicState.value?.lastCut?.seat === localSeat.value) {
      sound.vibrate('cut')
    }
  })

  /* Each bid spoken: a knock on the table. */
  watch(() => publicState.value?.bidSpoken.length ?? 0, (count, previous) => {
    if (primed && count > previous && publicState.value?.phase !== 'Lobby') {
      sound.play('bid')
    }
  })

  /* The dog turned face up. */
  watch(() => Boolean(publicState.value?.chienRevealed?.length), (shown, previous) => {
    if (primed && shown && !previous) {
      sound.play('chien')
    }
  })

  /* Reactions. */
  let lastEmoteId = 0
  watch(emotes, (list) => {
    const newest = list.reduce((max, item) => Math.max(max, item.id), 0)
    if (newest > lastEmoteId) {
      lastEmoteId = newest
      sound.play('emote')
      const item = list.find(entry => entry.id === newest)
      if (item && item.seat !== localSeat.value) {
        sound.vibrate('emote')
      }
    }
  }, { deep: true })

  /* End of a deal (and of the match): a jingle, happy or not. */
  watch(() => publicState.value?.phase, (phase, previous) => {
    const state = publicState.value
    if (!primed || !state || !previous || previous === phase || (phase !== 'Scoring' && phase !== 'MatchOver')) {
      return
    }
    if (previous === 'Scoring' && phase === 'MatchOver') {
      // Already heard the deal; only the match result now.
    } else if (state.lastDeal) {
      const seat = localSeat.value
      const won = seat !== null ? (state.lastDeltas?.[seat] ?? 0) > 0 : state.lastDeal.success
      sound.play(won ? 'dealWin' : 'dealLose', 0.35)
      sound.vibrate(won ? 'dealWin' : 'dealLose')
    }
    if (phase === 'MatchOver' && localSeat.value !== null) {
      const best = Math.max(...state.scores)
      if (state.scores[localSeat.value] === best) {
        sound.play('matchWin', previous === 'Scoring' ? 0.2 : 1.6)
      }
    }
  })

  onBeforeUnmount(() => clearTimeout(turnTimer))

  return sound
}
