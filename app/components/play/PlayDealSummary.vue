<script setup lang="ts">
import { motion } from 'motion-v'
import type { PublicGameView } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'
import { seatAvatar } from '~/utils/seatAvatar'

/**
 * End of a deal, on a cream sheet: was the contract made, the bouts and the
 * points needed, the points made, then base, gap, multiplier and bonuses, line
 * by line. Beside it, what each player wins or pays, counting up to their new
 * total. The next deal starts by itself (gauge) unless someone pauses.
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
}>()

const emit = defineEmits<{
  continue: []
  hold: []
  /** Go through the tricks of the deal again (the table waits). */
  review: []
}>()

const canReview = computed(() => Boolean(props.state.dealTricks?.length))

const deal = computed(() => props.state.lastDeal ?? null)

function seatName(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const title = computed(() => {
  const value = deal.value
  if (!value) {
    return 'Fin de la donne'
  }
  const contract = contractLabels[value.contract]
  const gap = Math.abs(value.diff)
  return value.success
    ? gap ? `${contract} faite de ${gap}` : `${contract} faite tout juste`
    : `${contract} chutée de ${gap}`
})

const subtitle = computed(() => {
  const value = deal.value
  if (!value) {
    return 'Tout le monde a passé.'
  }
  const taker = seatName(value.takerSeat)
  const partner = value.partnerSeat != null ? seatName(value.partnerSeat) : null
  if (value.takerSeat === props.localSeat) {
    return partner ? `Vous avez pris, avec ${partner}` : 'Vous avez pris'
  }
  return partner ? `${taker} a pris, avec ${partner}` : `${taker} a pris`
})

function signed(value: number) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
}

function half(value: number) {
  return Number.isInteger(value) ? String(value) : `${Math.floor(value)}½`
}

/** The calculation, one line at a time. */
const rows = computed(() => {
  const value = deal.value
  if (!value) {
    return []
  }
  const list: Array<{ label: string, value: string, tone?: 'good' | 'bad' | 'mute' | 'strong' }> = [
    { label: `${value.oudlers} bout${value.oudlers > 1 ? 's' : ''} · il fallait`, value: String(value.required) },
    { label: 'Points réalisés', value: half(value.points), tone: 'strong' },
    { label: 'Base + écart', value: `25 + ${Math.abs(value.diff)}` },
    { label: contractLabels[value.contract], value: `× ${value.multiplier}` }
  ]
  list.push(value.petitPart
    ? { label: 'Petit au bout', value: signed(value.petitPart), tone: value.petitPart > 0 ? 'good' : 'bad' }
    : { label: 'Petit au bout', value: '–', tone: 'mute' })
  if (value.poigneePart) {
    list.push({ label: 'Poignée', value: signed(Math.abs(value.poigneePart)) })
  }
  if (value.chelemPart) {
    list.push({ label: 'Chelem', value: signed(value.chelemPart), tone: value.chelemPart > 0 ? 'good' : 'bad' })
  }
  return list
})

const perDefender = computed(() => Math.abs(deal.value?.perDefender ?? 0))

const players = computed(() => props.state.seats
  .map((seat, index) => {
    const delta = Number(props.state.lastDeltas?.[index] ?? 0)
    const total = props.state.scores[index] ?? 0
    return {
      index,
      name: seatName(index),
      avatar: seatAvatar(seat),
      delta,
      total,
      before: total - delta,
      role: deal.value?.takerSeat === index ? 'taker' : deal.value?.partnerSeat === index ? 'partner' : 'defense'
    }
  })
  .sort((a, b) => b.delta - a.delta))

/** Points count up once the sheet is in. */
const counted = shallowRef(false)
const prefersReduced = usePreferredReducedMotion()
onMounted(() => {
  window.setTimeout(() => {
    counted.value = true
  }, prefersReduced.value === 'reduce' ? 0 : 900 + rows.value.length * 160)
})
const countProgress = useTransition(computed(() => counted.value ? 1 : 0), { duration: 900, transition: [0.2, 0.8, 0.2, 1] })

/* Next deal by itself: countdown from the server's deadline. */
const AUTO_MS = 15_000
const now = useNow({ interval: 250 })
const remainingMs = computed(() => props.state.autoContinueAt && !props.state.scoringHeld
  ? Math.max(0, props.state.autoContinueAt - now.value.getTime())
  : null)
const remainingS = computed(() => remainingMs.value == null ? null : Math.ceil(remainingMs.value / 1000))
const gauge = computed(() => remainingMs.value == null ? null : Math.min(1, remainingMs.value / AUTO_MS))

const nextLabel = computed(() => props.state.matchShouldEnd ? 'Classement' : 'Continuer')
const isShort = useMediaQuery('(max-height: 520px)')
</script>

<template>
  <div class="flex w-full flex-col items-center gap-3 short:gap-2">
    <div class="flex w-full flex-col items-stretch gap-3 short:flex-row short:items-start short:justify-center">
      <!-- The calculation -->
      <motion.section
        class="table-paper relative mx-auto w-full max-w-[19rem] rounded-lg px-4 pt-5 pb-3 short:mx-0 short:w-[17.5rem] short:pt-4 short:pb-2"
        :initial="prefersReduced ? { opacity: 0 } : { opacity: 0, y: 30, rotate: -2 }"
        :animate="{ opacity: 1, y: 0, rotate: 0 }"
        :transition="{ type: 'spring', stiffness: 220, damping: 20 }"
      >
        <motion.span
          class="absolute -top-3.5 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full text-white shadow-md ring-2 ring-[#f2d79a]"
          :class="deal?.success ? 'bg-[#3f7a57]' : 'bg-[#b23a2a]'"
          :initial="prefersReduced ? false : { scale: 0, rotate: -90 }"
          :animate="{ scale: 1, rotate: 0 }"
          :transition="{ type: 'spring', stiffness: 400, damping: 14, delay: 0.25 }"
        >
          <UIcon
            :name="deal?.success ? 'i-lucide-check' : 'i-lucide-x'"
            class="size-4"
          />
        </motion.span>
        <h2 class="text-center font-display text-[26px] leading-tight short:text-[22px]">
          {{ title }}
        </h2>
        <p class="mb-2 text-center text-[11px] text-[#3b2a18]/60">
          {{ subtitle }}
        </p>
        <motion.div
          v-for="(row, index) in rows"
          :key="row.label"
          class="flex items-baseline justify-between border-b border-dashed border-[#5a3c1e]/25 py-[3px] text-[13px] font-semibold short:py-[2px] short:text-xs"
          :class="row.tone === 'mute' ? 'opacity-40' : ''"
          :initial="prefersReduced ? false : { opacity: 0, x: -12 }"
          :animate="{ opacity: row.tone === 'mute' ? 0.4 : 1, x: 0 }"
          :transition="{ duration: 0.35, delay: 0.35 + index * 0.16 }"
        >
          <span>{{ row.label }}</span>
          <b
            class="text-sm tabular-nums"
            :class="row.tone === 'good' ? 'text-emerald-800' : row.tone === 'bad' ? 'text-[#9b2a1e]' : row.tone === 'strong' ? 'text-base' : ''"
          >{{ row.value }}</b>
        </motion.div>
        <motion.div
          v-if="deal"
          class="flex items-baseline justify-between pt-1.5 text-sm font-extrabold"
          :class="deal.success ? 'text-emerald-800' : 'text-[#9b2a1e]'"
          :initial="prefersReduced ? false : { opacity: 0, scale: 0.9 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="{ type: 'spring', stiffness: 300, damping: 16, delay: 0.4 + rows.length * 0.16 }"
        >
          <span>{{ deal.success ? 'Chaque défenseur paie' : 'Chaque défenseur reçoit' }}</span>
          <b class="text-lg tabular-nums">{{ Math.round(perDefender * countProgress) }}</b>
        </motion.div>
      </motion.section>

      <!-- Each player -->
      <motion.section
        class="table-paper mx-auto w-full max-w-[19rem] rounded-lg px-3 py-2 short:mx-0 short:w-[15.5rem]"
        :initial="prefersReduced ? { opacity: 0 } : { opacity: 0, y: 30, rotate: 2 }"
        :animate="{ opacity: 1, y: 0, rotate: 0 }"
        :transition="{ type: 'spring', stiffness: 220, damping: 20, delay: 0.15 }"
      >
        <ol class="divide-y divide-dashed divide-[#5a3c1e]/25">
          <li
            v-for="player in players"
            :key="player.index"
            class="flex items-center gap-2 py-1 short:py-[3px]"
          >
            <span class="relative shrink-0">
              <img
                v-if="player.avatar.src"
                :src="player.avatar.src"
                alt=""
                class="size-7 rounded-full object-cover ring-2 ring-[#c9a463] short:size-6"
                referrerpolicy="no-referrer"
              >
              <span
                v-else
                class="grid size-7 place-items-center rounded-full bg-[#e8d5a8] text-[11px] font-bold ring-2 ring-[#c9a463] short:size-6"
              >{{ player.avatar.initials }}</span>
              <span
                class="absolute -top-1 -right-1.5 grid size-3.5 place-items-center rounded-full text-white ring-1 ring-[#f2d79a]"
                :class="player.role === 'taker' ? 'bg-[#b23a2a]' : player.role === 'partner' ? 'bg-[#2f8fb0]' : 'bg-[#2d5e9c]'"
              >
                <UIcon
                  :name="player.role === 'taker' ? 'i-lucide-sword' : player.role === 'partner' ? 'i-lucide-handshake' : 'i-lucide-shield'"
                  class="size-2.5"
                />
              </span>
            </span>
            <span
              class="min-w-0 flex-1 truncate text-[13px] font-semibold"
              :class="player.index === localSeat ? 'text-[#7a4a10]' : ''"
            >{{ player.name }}</span>
            <b
              class="w-12 text-right text-sm tabular-nums"
              :class="player.delta > 0 ? 'text-emerald-800' : player.delta < 0 ? 'text-[#9b2a1e]' : 'text-[#3b2a18]/50'"
            >{{ signed(Math.round(player.delta * countProgress)) }}</b>
            <span class="w-12 text-right text-xs text-[#3b2a18]/60 tabular-nums">{{ Math.round(player.before + player.delta * countProgress) }}</span>
          </li>
        </ol>
      </motion.section>
    </div>

    <motion.div
      class="flex flex-wrap items-center justify-center gap-3"
      :initial="prefersReduced ? false : { opacity: 0, y: 12 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ delay: 0.6 + rows.length * 0.16 }"
    >
      <PlayGameButton
        v-if="canReview"
        label="Revoir les plis"
        icon="i-lucide-history"
        :size="isShort ? 'md' : 'lg'"
        @click="emit('review')"
      />
      <PlayGameButton
        v-if="!state.scoringHeld && remainingS != null"
        label="Pause"
        icon="i-lucide-pause"
        :size="isShort ? 'md' : 'lg'"
        @click="emit('hold')"
      />
      <PlayGameButton
        variant="gold"
        :size="isShort ? 'md' : 'lg'"
        trailing-icon="i-lucide-arrow-right"
        :progress="gauge"
        @click="emit('continue')"
      >
        {{ nextLabel }}<span
          v-if="remainingS != null"
          class="ml-1 text-xs font-bold opacity-70 tabular-nums"
        >{{ remainingS }} s</span>
      </PlayGameButton>
    </motion.div>
  </div>
</template>
