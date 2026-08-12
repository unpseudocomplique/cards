<script setup lang="ts">
import type { CardId, PrivateGameView, PublicGameView } from '~~/shared/tarot'
import {
  boutLabel,
  describeTrick,
  isBout,
  isPetitStolen,
  resolveTrick,
} from '~~/shared/tarot'
import { seatAnchor } from '~/utils/seatLayout'
import type { TableFxEvent } from '~/components/play/TableFxOverlay.vue'

const props = defineProps<{
  code: string
  publicState: PublicGameView
  privateState: PrivateGameView | null
  debugGfx?: boolean
  showHand?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const { settings, noteFpsSample, profile } = usePlayQuality()
const textures = useCardTextures(toRef(props, 'code'), settings)
const isMobile = useMediaQuery('(max-width: 640px)')

const castSalt = computed(() => {
  const code = props.code
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
})

const localSeat = computed(() => props.privateState?.seat ?? 0)
const fps = shallowRef(0)
let frames = 0
let lastTs = 0

/** Full-screen loader until canvas paints + priority textures settle (anti layout-shift). */
const canvasMounted = shallowRef(false)
const frameReady = shallowRef(false)
const minLoaderElapsed = shallowRef(false)
const loaderVisible = shallowRef(true)
let readyFrameCount = 0

const texturesWarm = computed(() => {
  if (textures.loading.value && textures.faces.value.size < 4) {
    return false
  }
  return textures.manifest.value !== null || textures.faces.value.size > 0 || !textures.loading.value
})

const sceneReady = computed(() =>
  canvasMounted.value
  && frameReady.value
  && texturesWarm.value
  && minLoaderElapsed.value,
)

onMounted(() => {
  window.setTimeout(() => {
    minLoaderElapsed.value = true
  }, 650)
  measureScene()
  window.addEventListener('resize', measureScene)
})

watch(sceneReady, (ready) => {
  if (!ready) {
    return
  }
  window.setTimeout(() => {
    loaderVisible.value = false
  }, 120)
  measureScene()
})

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

const faceUrlMap = computed(() => {
  const map = new Map<string, string | null>()
  for (const card of textures.manifest.value?.cards ?? []) {
    map.set(card.cardCode, card.faceUrl)
  }
  return map
})

const backUrl = computed(() => textures.manifest.value?.backUrl ?? null)

const sceneRoot = ref<HTMLElement | null>(null)
const sceneSize = shallowRef({ width: 0, height: 0 })

type TrickEntry = { seat: number, card: CardId }
type FlightState = {
  card: CardId
  faceUrl: string | null
  from: { left: number, top: number, width: number, height: number }
  to: { left: number, top: number }
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
const TRICK_COLLECT_MS = 1_400
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
    accent: 'gold',
  }, 1_800)
}

watch(
  () => props.publicState.dealIndex,
  () => {
    celebratedBouts.clear()
  },
)

function celebratePetitSteal(victimSeat: number, thiefSeat: number) {
  pushFx({
    kind: 'petit-steal',
    title: 'Petit volé !',
    subtitle: `${seatName(thiefSeat)} pique le Petit de ${seatName(victimSeat)}`,
    accent: 'rose',
  }, TRICK_SUMMARY_TTL_MS)
}

function celebrateTrickSummary(trickCards: TrickEntry[], winnerSeat: number) {
  try {
    const summary = describeTrick(props.publicState, trickCards)
    trickSummaryLine.value = `${summary.title} — ${summary.subtitle}`
    pushFx({
      kind: 'trick-won',
      title: summary.title,
      subtitle: summary.subtitle,
      details: summary.details,
      accent: summary.accent,
    }, TRICK_SUMMARY_TTL_MS)
  }
  catch {
    const name = seatName(winnerSeat)
    trickSummaryLine.value = `Pli pour ${name}`
    pushFx({
      kind: 'trick-won',
      title: `Pli pour ${name}`,
      subtitle: 'Le pli est ramassé',
      accent: 'slate',
    }, TRICK_SUMMARY_TTL_MS)
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

function trickCenter(width: number, height: number, cardW: number, cardH: number) {
  return {
    left: width / 2 - cardW * 0.35,
    top: height * 0.36 - cardH * 0.35,
  }
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
  const anchor = seatAnchor(seat, localSeat.value, props.publicState.playerCount, width, height)
  const cardW = 56
  const cardH = 84
  enqueueFlight({
    card,
    faceUrl: faceUrlFor(card),
    from: {
      left: anchor.x - cardW / 2,
      top: anchor.y - cardH / 2,
      width: cardW,
      height: cardH,
    },
    to: trickCenter(width, height, cardW, cardH),
  })
}

function onHandPlay(card: CardId, origin?: DOMRect) {
  const scene = measureScene()
  const fallbackWidth = 70
  const fallbackHeight = 105
  const rect = origin && origin.width > 8
    ? origin
    : new DOMRect(
        scene.left + scene.width / 2 - fallbackWidth / 2,
        scene.top + scene.height - 160,
        fallbackWidth,
        fallbackHeight,
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
      height,
    },
    to: trickCenter(scene.width, scene.height, width, height),
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
  }
  else {
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
              item => item.seat === entry.seat && item.card === entry.card,
            )
            if (!wasShown && entry.seat !== localSeat.value) {
              spawnSeatFlight(entry.seat, entry.card)
            }
          }
          beginCollect(winner, finished)
          knownTrickKey = finishedKey
        }
      }
      else if (displayTrick.value.length > 0) {
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
  { deep: true, immediate: true },
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
        item => item.seat === entry.seat && item.card === entry.card,
      )
      if (!wasShown && entry.seat !== localSeat.value) {
        spawnSeatFlight(entry.seat, entry.card)
      }
    }
    beginCollect(winner, finished)
    knownTrickKey = finishedKey
  },
)

onUnmounted(() => {
  window.removeEventListener('resize', measureScene)
  if (collectTimer) {
    clearTimeout(collectTimer)
  }
  if (holdTimer) {
    clearTimeout(holdTimer)
  }
  textures.disposeAll()
})

const visibleTrick = computed(() => {
  if (!suppressUntil.value) {
    return displayTrick.value
  }
  let skipped = false
  const next: TrickEntry[] = []
  for (let i = displayTrick.value.length - 1; i >= 0; i--) {
    const entry = displayTrick.value[i]!
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

const cameraPosition = computed<[number, number, number]>(() =>
  isMobile.value ? [0, 3.25, 6.35] : [0, 2.95, 6.05],
)

const cameraLookAt = computed<[number, number, number]>(() =>
  isMobile.value ? [0, 0.85, -0.2] : [0, 0.95, -0.25],
)

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

watch(priorityCodes, (codes) => {
  textures.prioritize(codes)
}, { immediate: true })

function onLoop({ delta }: { delta: number }) {
  canvasMounted.value = true
  if (!frameReady.value) {
    readyFrameCount++
    if (readyFrameCount >= 8) {
      frameReady.value = true
    }
  }
  const dt = delta * 1000
  frames++
  lastTs += dt
  if (lastTs >= 500) {
    const sample = (frames / lastTs) * 1000
    fps.value = Math.round(sample)
    noteFpsSample(sample, lastTs)
    frames = 0
    lastTs = 0
  }
}
</script>

<template>
  <div
    ref="sceneRoot"
    class="relative h-full w-full overflow-hidden bg-[#0c0908]"
  >
    <ClientOnly>
      <TresCanvas
        clear-color="#0c0908"
        class="pointer-events-none h-full w-full touch-none"
        :dpr="isMobile ? Math.min(settings.dprCap, 1.15) : settings.dprCap"
        :render-mode="'always'"
        :shadows="!isMobile && settings.shadows"
        @loop="onLoop"
      >
        <TresPerspectiveCamera
          :position="cameraPosition"
          :look-at="cameraLookAt"
          :fov="isMobile ? 46 : 42"
        />

        <!-- Dramatic salon key + cool rim (no EffectComposer) -->
        <TresHemisphereLight :args="['#ffe8d0', '#3a2418', 0.7]" />
        <TresAmbientLight :intensity="0.62" />
        <TresDirectionalLight
          :position="[2.8, 5.5, 4.0]"
          :intensity="1.45"
          :cast-shadow="!isMobile && settings.shadows"
          color="#ffe2b8"
        />
        <TresDirectionalLight
          v-if="!isMobile"
          :position="[-4.5, 3.2, -2.5]"
          :intensity="0.7"
          color="#9aaccc"
        />
        <TresPointLight
          :position="[0, 2.4, 1.5]"
          color="#ffd7a8"
          :intensity="1.15"
          :distance="14"
          :decay="2"
        />
        <TresDirectionalLight
          :position="[0, 3.6, 4.2]"
          :intensity="0.55"
          color="#ffe8d0"
        />

        <PlayTresTableFelt
          :quality="profile"
          :shadows="!isMobile && settings.shadows"
        />
        <PlayTresRoomAmbiance
          :player-count="publicState.playerCount"
          :local-seat="localSeat"
          :quality="profile"
          :shadows="!isMobile && settings.shadows"
          :cast-salt="castSalt"
        />

        <PlayTresOpponentStacks
          :hand-counts="publicState.handCounts"
          :local-seat="localSeat"
          :player-count="publicState.playerCount"
          :get-back="textures.getBack"
        />
      </TresCanvas>
    </ClientOnly>

    <!-- Hold overlays until scene ready to avoid layout jump -->
    <div
      class="absolute inset-0 z-20 transition-opacity duration-300"
      :class="showHud ? 'opacity-100' : 'pointer-events-none opacity-0'"
    >
      <PlayTableFxOverlay :events="tableFx" />

      <PlayWonTrickPiles
        v-if="sceneSize.width > 0"
        :tricks-won-by-seat="publicState.tricksWonBySeat ?? []"
        :local-seat="localSeat"
        :player-count="publicState.playerCount"
        :seats="publicState.seats"
        :scene-width="sceneSize.width"
        :scene-height="sceneSize.height"
        :highlight-seat="collectingToSeat"
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
        :collecting-to-seat="collectingToSeat"
        :winner-name="winnerName"
        :hold-banner="holdBanner"
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

    <div
      v-if="debugGfx"
      class="pointer-events-none absolute left-3 top-3 z-40 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] text-white/90"
    >
      {{ profile }} · {{ fps }} fps · tex {{ textures.faces.size }}
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
        <div class="text-center">
          <p class="font-serif text-lg tracking-wide text-[#e8d5a8]">
            Préparation de la table
          </p>
          <p class="mt-1 text-xs text-white/45">
            {{ textures.loading ? 'Chargement du deck…' : 'Mise en place du salon…' }}
          </p>
        </div>
        <div class="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-[#e0c06a]/80 transition-all duration-500"
            :style="{ width: sceneReady ? '100%' : texturesWarm ? '70%' : '35%' }"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
