<script setup lang="ts">
import type { CardId, PrivateGameView, PublicGameView } from '~~/shared/tarot'
import {
  boutLabel,
  describeTrick,
  isBout,
  isPetitStolen,
  resolveTrick
} from '~~/shared/tarot'
import { isPortraitView, seatAnchor, seatTrickCardHeight, seatTrickSpot, seatTrickTilt, trickCardHeight, trickLayout, trickZone } from '~/utils/seatLayout'
import { preloadImages } from '~/utils/preloadImages'
import type { ShownEmote } from '~/composables/useTableEmotes'
import type { TableFxEvent } from '~/components/play/TableFxOverlay.vue'

const props = defineProps<{
  code: string
  publicState: PublicGameView
  privateState: PrivateGameView | null
  debugGfx?: boolean
  showHand?: boolean
  /** Players' reactions, shown above their heads. */
  emotes?: ShownEmote[]
  /** 5 players: the local player secretly holds the called king. */
  calledPartner?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
  scores: []
}>()

const deck = useDeckFaceUrls(toRef(props, 'code'))
const isMobile = useMediaQuery('(max-width: 640px)')

const localSeat = computed(() => props.privateState?.seat ?? 0)

/** Short loader until the deck's faces are known, so cards do not change look under the eyes. */
const loaderVisible = shallowRef(true)
onMounted(() => {
  measureScene()
  window.addEventListener('resize', measureScene)
  // Never wait more than a moment: classic faces stand in for missing art.
  window.setTimeout(() => {
    loaderVisible.value = false
  }, 1600)
})
watch(() => deck.pending.value, (pending) => {
  if (!pending && import.meta.client) {
    window.setTimeout(() => {
      loaderVisible.value = false
      measureScene()
    }, 120)
  }
}, { immediate: true })

const showHud = computed(() => !loaderVisible.value)

const canInteractHand = computed(() => {
  const phase = props.publicState.phase
  if (phase !== 'Trick' && phase !== 'ReadyToPlay') {
    return false
  }
  if (!props.privateState) {
    return false
  }
  return props.publicState.currentSeat === props.privateState.seat
    && (props.privateState.legalMoves?.length ?? 0) > 0
})

const faceUrlMap = computed(() => deck.faceUrls.value)
const backUrl = computed(() => deck.backUrl.value)

// Faces in the browser cache before anyone plays them (hand and trick first).
watch(() => [...deck.faceUrls.value.entries()].length, (_count, _old, onCleanup) => {
  if (!import.meta.client) {
    return
  }
  const first = new Set(priorityCodes.value)
  const urls = [...deck.faceUrls.value.entries()]
    .sort(([a], [b]) => Number(first.has(b)) - Number(first.has(a)))
    .map(([, url]) => url)
    .filter((url): url is string => Boolean(url))
  onCleanup(preloadImages(urls))
})
/** Card width / height of the deck format (tarot 61 × 112 mm or poker). */
const cardRatio = computed(() => deck.cardRatio.value)

const sceneRoot = ref<HTMLElement | null>(null)
const sceneSize = shallowRef({ width: 0, height: 0 })

type TrickEntry = { seat: number, card: CardId }
type FlightState = {
  card: CardId
  faceUrl: string | null
  from: { left: number, top: number, width: number, height: number }
  to: { x: number, y: number, height: number, rotate: number, fade?: boolean }
}

const flights = ref<FlightState[]>([])
const displayTrick = ref<TrickEntry[]>([])
const collectingToSeat = shallowRef<number | null>(null)
const suppressUntil = shallowRef<CardId | null>(null)
const tableFx = ref<TableFxEvent[]>([])
const trickSummaryLine = shallowRef<string | null>(null)
let collectTimer: ReturnType<typeof setTimeout> | null = null
let holdTimer: ReturnType<typeof setTimeout> | null = null
let knownTrickKey = ''
let fxSeq = 0
const celebratedBouts = new Set<string>()

/** Keep the finished trick readable before sweeping cards away. */
const TRICK_HOLD_MS = 2_000
const TRICK_COLLECT_MS = 900
const TRICK_SUMMARY_TTL_MS = TRICK_HOLD_MS + TRICK_COLLECT_MS + 200

function pushFx(event: Omit<TableFxEvent, 'id'>, ttlMs = 1_600) {
  const id = `fx-${++fxSeq}`
  tableFx.value = [...tableFx.value, { ...event, id }]
  window.setTimeout(() => {
    tableFx.value = tableFx.value.filter(item => item.id !== id)
  }, ttlMs)
}

function seatName(seat: number) {
  return props.publicState.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

function celebrateBout(card: CardId, seat: number) {
  if (!isBout(card)) {
    return
  }
  // One FX per bout card per deal (unique in a donne).
  const softKey = `${props.publicState.dealIndex}:${seat}:${card}`
  if (celebratedBouts.has(softKey)) {
    return
  }
  celebratedBouts.add(softKey)
  const label = boutLabel(card) ?? 'Bout'
  pushFx({
    kind: 'bout',
    title: `${label} !`,
    subtitle: `${seatName(seat)} pose un bout`,
    accent: 'gold'
  }, 1_800)
}

watch(
  () => props.publicState.dealIndex,
  () => {
    celebratedBouts.clear()
  }
)

function celebratePetitSteal(victimSeat: number, thiefSeat: number) {
  pushFx({
    kind: 'petit-steal',
    title: 'Petit volé !',
    subtitle: `${seatName(thiefSeat)} pique le Petit de ${seatName(victimSeat)}`,
    accent: 'rose'
  }, TRICK_SUMMARY_TTL_MS)
}

function celebrateTrickSummary(trickCards: TrickEntry[], winnerSeat: number) {
  try {
    const summary = describeTrick(props.publicState, trickCards)
    // One quiet line by the trick; the full-screen panel is kept for bouts and steals.
    trickSummaryLine.value = `${summary.title} — ${summary.subtitle}`
  } catch {
    trickSummaryLine.value = `Pli pour ${seatName(winnerSeat)}`
  }
}

function faceUrlFor(card: CardId): string | null {
  return faceUrlMap.value.get(card) ?? null
}

function measureScene() {
  const box = sceneRoot.value?.getBoundingClientRect()
  if (!box) {
    return { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 }
  }
  sceneSize.value = { width: box.width, height: box.height }
  return { width: box.width, height: box.height, left: box.left, top: box.top }
}

/** Where a played card lands: its spot on the felt (centre, height, angle). */
function trickTarget(width: number, height: number, seat: number) {
  const view = { width, height, mobile: isMobile.value }
  const count = props.publicState.playerCount
  if (trickLayout(view) === 'seat') {
    // Same spot, size and lean as the card drawn by TrickOverlay.
    const spot = seatTrickSpot(seat, localSeat.value, count, view)
    return { x: spot.x, y: spot.y, height: seatTrickCardHeight(view, count), rotate: seatTrickTilt(seat, localSeat.value, count) }
  }
  // Row: the card joins the end of the row, around the middle of the felt.
  const cardH = trickCardHeight(view, count) ?? 84
  return { x: width / 2, y: trickZone(view, count).centerY, height: cardH, rotate: ((seat % 5) - 2) * 4, fade: true }
}

function enqueueFlight(flight: FlightState) {
  flights.value = [...flights.value, flight]
}

function onFlightDone(card: CardId) {
  flights.value = flights.value.filter(item => item.card !== card)
  if (suppressUntil.value === card) {
    suppressUntil.value = null
  }
}

function spawnSeatFlight(seat: number, card: CardId) {
  const { width, height } = measureScene()
  // Opponents' cards leave from their stack on the rim (projected from 3D).
  const anchor = seatAnchor(seat, localSeat.value, props.publicState.playerCount, { width, height, mobile: isMobile.value })
  const cardH = 84
  const cardW = Math.round(cardH * cardRatio.value)
  enqueueFlight({
    card,
    faceUrl: faceUrlFor(card),
    from: {
      left: anchor.x - cardW / 2,
      top: anchor.y - cardH / 2,
      width: cardW,
      height: cardH
    },
    to: trickTarget(width, height, seat)
  })
}

/** The finished trick is still on show (hold, then sweep to the winner). */
function collectInProgress() {
  return holdTimer !== null || collectTimer !== null
}

/**
 * After a sweep, catch up with cards played meanwhile (another player can lead
 * the next trick while we are still showing the last one).
 */
function syncLiveTrick() {
  const next = props.publicState.trick ?? []
  const shown = new Set(displayTrick.value.map(entry => `${entry.seat}:${entry.card}`))
  for (const entry of next) {
    if (shown.has(`${entry.seat}:${entry.card}`)) {
      continue
    }
    spawnSeatFlight(entry.seat, entry.card)
    if (entry.seat !== localSeat.value) {
      celebrateBout(entry.card, entry.seat)
    }
  }
  displayTrick.value = next.map(entry => ({ ...entry }))
  knownTrickKey = next.map(entry => `${entry.seat}:${entry.card}`).join('|')
}

function onHandPlay(card: CardId, origin?: DOMRect) {
  if (collectInProgress()) {
    // The last trick is still on the felt: the card joins the table after the sweep.
    celebrateBout(card, localSeat.value)
    emit('play', card)
    return
  }
  const scene = measureScene()
  const fallbackHeight = 105
  const fallbackWidth = Math.round(fallbackHeight * cardRatio.value)
  const rect = origin && origin.width > 8
    ? origin
    : new DOMRect(
        scene.left + scene.width / 2 - fallbackWidth / 2,
        scene.top + scene.height - 160,
        fallbackWidth,
        fallbackHeight
      )

  const width = Math.max(rect.width, 48)
  const height = Math.max(rect.height, 72)
  suppressUntil.value = card
  enqueueFlight({
    card,
    faceUrl: faceUrlFor(card),
    from: {
      left: rect.left - scene.left,
      top: rect.top - scene.top,
      width,
      height
    },
    to: trickTarget(scene.width, scene.height, localSeat.value)
  })
  // Fire immediately — last-card plays never appear in publicState.trick.
  celebrateBout(card, localSeat.value)
  emit('play', card)
  window.setTimeout(() => {
    if (suppressUntil.value === card) {
      suppressUntil.value = null
    }
  }, 900)
}

function beginCollect(winnerSeat: number, trickCards: TrickEntry[]) {
  if (collectTimer) {
    clearTimeout(collectTimer)
  }
  if (holdTimer) {
    clearTimeout(holdTimer)
  }

  displayTrick.value = trickCards.map(entry => ({ ...entry }))
  collectingToSeat.value = null

  for (const entry of trickCards) {
    celebrateBout(entry.card, entry.seat)
  }

  const steal = isPetitStolen(props.publicState, trickCards, winnerSeat)
  if (steal.stolen) {
    celebratePetitSteal(steal.victimSeat, steal.thiefSeat)
    trickSummaryLine.value = `Petit volé — pli pour ${seatName(winnerSeat)}`
  } else {
    celebrateTrickSummary(trickCards, winnerSeat)
  }

  // Hold the completed trick + explanation, then sweep toward the winner.
  holdTimer = setTimeout(() => {
    holdTimer = null
    collectingToSeat.value = winnerSeat
    collectTimer = setTimeout(() => {
      displayTrick.value = []
      collectingToSeat.value = null
      trickSummaryLine.value = null
      collectTimer = null
      syncLiveTrick()
    }, steal.stolen ? TRICK_COLLECT_MS + 250 : TRICK_COLLECT_MS)
  }, steal.stolen ? TRICK_HOLD_MS + 400 : TRICK_HOLD_MS)
}

watch(
  () => props.publicState.trick,
  (trick) => {
    const next = trick ?? []
    const key = next.map(entry => `${entry.seat}:${entry.card}`).join('|')

    if (next.length === 0 && collectingToSeat.value == null) {
      const finished = props.publicState.lastTrick
      const winner = props.publicState.lastTrickWinnerSeat
      if (finished?.length && winner != null) {
        const finishedKey = finished.map(entry => `${entry.seat}:${entry.card}`).join('|')
        if (finishedKey !== knownTrickKey) {
          // Ensure last card (often Excuse) is visible + celebrated for everyone.
          for (const entry of finished) {
            const wasShown = displayTrick.value.some(
              item => item.seat === entry.seat && item.card === entry.card
            )
            if (!wasShown && entry.seat !== localSeat.value) {
              spawnSeatFlight(entry.seat, entry.card)
            }
          }
          beginCollect(winner, finished)
          knownTrickKey = finishedKey
        }
      } else if (displayTrick.value.length > 0) {
        try {
          const { winnerSeat } = resolveTrick(displayTrick.value)
          beginCollect(winnerSeat, displayTrick.value)
        } catch {
          displayTrick.value = []
        }
        knownTrickKey = ''
      }
      return
    }

    if (key === knownTrickKey) {
      return
    }

    // Next trick already started while the last one is still shown: keep the
    // finished trick readable, the new cards come in after the sweep.
    if (collectInProgress()) {
      return
    }

    // New cards played: fly opponents' cards from their seat.
    if (next.length > displayTrick.value.length && collectingToSeat.value == null) {
      const known = new Set(displayTrick.value.map(entry => `${entry.seat}:${entry.card}`))
      for (const entry of next) {
        const entryKey = `${entry.seat}:${entry.card}`
        if (known.has(entryKey)) {
          continue
        }
        const isLocalFlight = entry.seat === localSeat.value && suppressUntil.value === entry.card
        if (!isLocalFlight && entry.seat !== localSeat.value) {
          spawnSeatFlight(entry.seat, entry.card)
        }
        if (entry.seat !== localSeat.value) {
          celebrateBout(entry.card, entry.seat)
        }
      }
      displayTrick.value = next.map(entry => ({ ...entry }))
      knownTrickKey = key
      return
    }

    if (collectingToSeat.value == null) {
      displayTrick.value = next.map(entry => ({ ...entry }))
      knownTrickKey = key
    }
  },
  { deep: true, immediate: true }
)

// Also react when lastTrick arrives without a trick-length transition (same tick clear).
watch(
  () => props.publicState.lastTrickWinnerSeat,
  (winner) => {
    if (winner == null || collectingToSeat.value != null) {
      return
    }
    const finished = props.publicState.lastTrick
    if (!finished?.length) {
      return
    }
    const finishedKey = finished.map(entry => `${entry.seat}:${entry.card}`).join('|')
    if (finishedKey === knownTrickKey) {
      return
    }
    for (const entry of finished) {
      const wasShown = displayTrick.value.some(
        item => item.seat === entry.seat && item.card === entry.card
      )
      if (!wasShown && entry.seat !== localSeat.value) {
        spawnSeatFlight(entry.seat, entry.card)
      }
    }
    beginCollect(winner, finished)
    knownTrickKey = finishedKey
  }
)

onUnmounted(() => {
  window.removeEventListener('resize', measureScene)
  if (collectTimer) {
    clearTimeout(collectTimer)
  }
  if (holdTimer) {
    clearTimeout(holdTimer)
  }
})

const visibleTrick = computed(() => {
  // A card still in the air is drawn by its flight, not twice.
  const flying = new Set(flights.value.map(item => item.card))
  const landed = flying.size ? displayTrick.value.filter(entry => !flying.has(entry.card)) : displayTrick.value
  if (!suppressUntil.value) {
    return landed
  }
  let skipped = false
  const next: TrickEntry[] = []
  for (let i = landed.length - 1; i >= 0; i--) {
    const entry = landed[i]!
    if (!skipped && entry.card === suppressUntil.value) {
      skipped = true
      continue
    }
    next.unshift(entry)
  }
  return next
})

const winnerName = computed(() => {
  if (collectingToSeat.value != null) {
    return props.publicState.seats[collectingToSeat.value]?.name ?? `Siège ${collectingToSeat.value + 1}`
  }
  return null
})

const holdBanner = computed(() => trickSummaryLine.value)

const portraitView = computed(() => isPortraitView({
  width: sceneSize.value.width || (import.meta.client ? window.innerWidth : 1),
  height: sceneSize.value.height || (import.meta.client ? window.innerHeight : 1)
}))
const shortView = computed(() => (sceneSize.value.height || (import.meta.client ? window.innerHeight : 900)) <= 520)

const priorityCodes = computed(() => {
  const codes = new Set<string>()
  for (const card of props.privateState?.hand ?? []) {
    codes.add(card)
  }
  for (const entry of props.publicState.trick ?? []) {
    codes.add(entry.card)
  }
  for (const card of props.publicState.chienRevealed ?? []) {
    codes.add(card)
  }
  return [...codes]
})
</script>

<template>
  <div
    ref="sceneRoot"
    class="relative h-full w-full overflow-hidden bg-[#0c0908]"
  >
    <PlayTableFelt
      :portrait="portraitView"
      :short="shortView"
      @scores="emit('scores')"
    />

    <div
      class="absolute inset-0 z-20 transition-opacity duration-500"
      :class="showHud ? 'opacity-100' : 'pointer-events-none opacity-0'"
    >
      <PlayTableFxOverlay :events="tableFx" />

      <PlaySeatMedallions
        v-if="sceneSize.width > 0"
        :state="publicState"
        :local-seat="localSeat"
        :scene-width="sceneSize.width"
        :scene-height="sceneSize.height"
        :mobile="isMobile"
        :active-seat="['Cutting', 'Bidding', 'Trick', 'ReadyToPlay'].includes(publicState.phase) ? publicState.currentSeat : null"
        :highlight-seat="collectingToSeat"
        :called-partner="calledPartner"
        :face-urls="faceUrlMap"
      />

      <PlayEmoteBubbles
        v-if="sceneSize.width > 0 && emotes?.length"
        :emotes="emotes"
        :local-seat="localSeat"
        :player-count="publicState.playerCount"
        :scene-width="sceneSize.width"
        :scene-height="sceneSize.height"
        :mobile="isMobile"
      />

      <PlayTrickOverlay
        v-if="visibleTrick.length"
        :trick="visibleTrick"
        :face-urls="faceUrlMap"
        :seats="publicState.seats"
        :local-seat="localSeat"
        :player-count="publicState.playerCount"
        :scene-width="sceneSize.width"
        :scene-height="sceneSize.height"
        :mobile="isMobile"
        :collecting-to-seat="collectingToSeat"
        :winner-name="winnerName"
        :hold-banner="holdBanner"
        :called-king="publicState.calledKing ?? null"
      />

      <PlayChienOverlay
        v-if="publicState.chienRevealed?.length"
        :cards="publicState.chienRevealed"
        :face-urls="faceUrlMap"
      />

      <div
        v-if="showHand !== false && privateState?.hand?.length"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-1 pb-3 sm:px-2 sm:pb-5"
      >
        <PlayHandArc
          :cards="privateState.hand"
          :legal-moves="privateState.legalMoves"
          :face-urls="faceUrlMap"
          :back-url="backUrl"
          :dim-unplayable="canInteractHand"
          :prompt="canInteractHand ? 'À vous de jouer' : null"
          @play="(card, origin) => onHandPlay(card, origin)"
        />
      </div>

      <PlayCardFlight
        v-for="item in flights"
        :key="`${item.card}-${item.from.left}-${item.from.top}`"
        :card-id="item.card"
        :face-url="item.faceUrl"
        :from="item.from"
        :to="item.to"
        @done="onFlightDone(item.card)"
      />
    </div>

    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="loaderVisible"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#0c0908]"
        role="status"
        aria-live="polite"
        aria-label="Chargement de la table"
      >
        <div class="relative flex h-28 w-28 items-center justify-center">
          <div class="absolute inset-0 rounded-full border border-[#e0c06a]/25" />
          <div class="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-[#e0c06a]" />
          <div class="h-16 w-11 rounded-sm bg-gradient-to-b from-[#6b2d4a] to-[#3f1d2e] shadow-lg ring-1 ring-[#e0c06a]/40" />
        </div>
        <p class="font-display text-lg tracking-wide text-[#e8d5a8]">
          Préparation de la table
        </p>
      </div>
    </Transition>
  </div>
</template>
