<script setup lang="ts">
import { motion } from 'motion-v'
import type { PublicGameView } from '~~/shared/tarot'
import { seatAvatar } from '~/utils/seatAvatar'

/**
 * End of the match: a podium rising from the cloth, the winner crowned, and a
 * few titles drawn from the deals played (best taker, finest deal, the
 * defence's rock, most tricks).
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
}>()

function seatName(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const ranking = computed(() => props.state.seats
  .map((seat, index) => ({ index, name: seatName(index), avatar: seatAvatar(seat), total: props.state.scores[index] ?? 0 }))
  .sort((a, b) => b.total - a.total))

const winner = computed(() => ranking.value[0] ?? null)
const youWin = computed(() => winner.value?.index === props.localSeat)

/** Podium order on screen: 2nd, 1st, 3rd. */
const podium = computed(() => {
  const [first, second, third] = ranking.value
  return [
    second && { ...second, place: 2, height: 46 },
    first && { ...first, place: 1, height: 68 },
    third && { ...third, place: 3, height: 32 }
  ].filter(Boolean) as Array<(typeof ranking.value)[number] & { place: number, height: number }>
})
const others = computed(() => ranking.value.slice(3))

const deals = computed(() => props.state.dealHistory ?? [])

function best<T>(items: T[], score: (item: T) => number) {
  let top: T | null = null
  let topScore = -Infinity
  for (const item of items) {
    const value = score(item)
    if (value > topScore) {
      top = item
      topScore = value
    }
  }
  return top && topScore > 0 ? { item: top, score: topScore } : null
}

const titles = computed(() => {
  const seats = props.state.seats.map((_, index) => index)
  const list: Array<{ icon: string, tone: string, label: string, who: string, detail: string }> = []

  const takes = seats.map(seat => ({
    seat,
    made: deals.value.filter(deal => deal.takerSeat === seat && deal.success).length,
    tried: deals.value.filter(deal => deal.takerSeat === seat).length
  }))
  const taker = best(takes, entry => entry.made * 10 + (entry.tried ? entry.made / entry.tried : 0))
  if (taker) {
    list.push({ icon: 'i-lucide-sword', tone: 'text-[#ff9c8a]', label: 'Meilleur preneur', who: seatName(taker.item.seat), detail: `${taker.item.made}/${taker.item.tried}` })
  }

  const finest = best(deals.value.flatMap(deal => seats.map(seat => ({ seat, delta: deal.deltas[seat] ?? 0 }))), entry => entry.delta)
  if (finest) {
    list.push({ icon: 'i-lucide-flame', tone: 'text-[#ffbf6b]', label: 'Plus belle donne', who: seatName(finest.item.seat), detail: `+${finest.item.delta}` })
  }

  const defence = best(seats.map(seat => ({
    seat,
    won: deals.value
      .filter(deal => deal.takerSeat !== seat && deal.partnerSeat !== seat)
      .reduce((total, deal) => total + Math.max(0, deal.deltas[seat] ?? 0), 0)
  })), entry => entry.won)
  if (defence) {
    list.push({ icon: 'i-lucide-shield', tone: 'text-[#b9d8ff]', label: 'Mur de la défense', who: seatName(defence.item.seat), detail: `+${defence.item.won}` })
  }

  const tricks = best(seats.map(seat => ({
    seat,
    count: deals.value.reduce((total, deal) => total + (deal.tricksWonBySeat[seat] ?? 0), 0)
  })), entry => entry.count)
  if (tricks) {
    list.push({ icon: 'i-lucide-layers', tone: 'text-[#f5c542]', label: 'Roi des plis', who: seatName(tricks.item.seat), detail: `${tricks.item.count} plis` })
  }
  return list
})

const prefersReduced = usePreferredReducedMotion()
const reduced = computed(() => prefersReduced.value === 'reduce')
const isShort = useMediaQuery('(max-height: 520px)')

/* A little confetti for the winner. */
const confetti = Array.from({ length: 26 }, (_, index) => ({
  left: (index * 37) % 100,
  delay: (index % 9) * 0.18,
  hue: ['#f6d98c', '#ff9c8a', '#9df0a8', '#b9d8ff', '#f9a8d4'][index % 5],
  rot: (index * 53) % 360
}))
</script>

<template>
  <section class="table-plaque relative w-full overflow-hidden rounded-2xl px-4 pt-4 pb-4 short:px-4 short:pt-3 short:pb-3">
    <div
      v-if="youWin && !reduced"
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <span
        v-for="(piece, index) in confetti"
        :key="index"
        class="podium-confetti"
        :style="{ left: `${piece.left}%`, animationDelay: `${piece.delay}s`, background: piece.hue, rotate: `${piece.rot}deg` }"
      />
    </div>

    <motion.h2
      class="text-center font-display text-3xl leading-tight text-[#f6d98c] short:text-2xl"
      :initial="reduced ? false : { opacity: 0, scale: 0.8 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ type: 'spring', stiffness: 260, damping: 16 }"
    >
      {{ youWin ? 'Vous gagnez la partie !' : `${winner?.name} gagne la partie` }}
    </motion.h2>
    <p class="text-center text-xs text-[#f6e7c4]/60">
      {{ deals.length }} donne{{ deals.length > 1 ? 's' : '' }} jouée{{ deals.length > 1 ? 's' : '' }}
    </p>

    <div class="mt-3 flex flex-col items-center gap-4 short:mt-2 short:flex-row short:items-end short:justify-center short:gap-6">
      <div class="flex items-end justify-center gap-2">
        <div
          v-for="(step, index) in podium"
          :key="step.index"
          class="flex flex-col items-center gap-1"
        >
          <motion.span
            v-if="step.place === 1"
            class="text-xl"
            :initial="reduced ? false : { opacity: 0, y: -40, rotate: -30 }"
            :animate="{ opacity: 1, y: 0, rotate: 0 }"
            :transition="{ type: 'spring', stiffness: 300, damping: 12, delay: 1.2 }"
          >
            👑
          </motion.span>
          <motion.div
            class="flex flex-col items-center gap-1"
            :initial="reduced ? false : { opacity: 0, y: 20 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: 0.5 + (3 - step.place) * 0.25 }"
          >
            <img
              v-if="step.avatar.src"
              :src="step.avatar.src"
              alt=""
              class="rounded-full object-cover ring-2 ring-[#c9a463]"
              :class="step.place === 1 ? 'size-14 short:size-12' : 'size-11 short:size-10'"
              referrerpolicy="no-referrer"
            >
            <span
              v-else
              class="grid place-items-center rounded-full bg-[#e8d5a8] font-bold text-[#3b2a18] ring-2 ring-[#c9a463]"
              :class="step.place === 1 ? 'size-14 text-lg short:size-12' : 'size-11 short:size-10'"
            >{{ step.avatar.initials }}</span>
            <span
              class="max-w-[6rem] truncate text-[11px]"
              :class="step.place === 1 ? 'font-bold text-[#f6e7c4]' : 'text-[#f6e7c4]/75'"
            >{{ step.name }} · {{ step.total }}</span>
          </motion.div>
          <motion.div
            class="grid w-[4.6rem] origin-bottom place-items-center rounded-t-lg border border-[#c9a463]/60 bg-gradient-to-b from-[#6a4c34] to-[#3a2a1e] font-display text-2xl text-[#f6d98c]"
            :style="{ height: `${isShort ? step.height * 0.75 : step.height}px` }"
            :initial="reduced ? false : { scaleY: 0 }"
            :animate="{ scaleY: 1 }"
            :transition="{ type: 'spring', stiffness: 140, damping: 16, delay: 0.15 + index * 0.12 }"
          >
            {{ step.place }}
          </motion.div>
        </div>
      </div>

      <div class="grid w-full max-w-md grid-cols-2 gap-1.5 short:w-auto short:max-w-sm">
        <motion.div
          v-for="(title, index) in titles"
          :key="title.label"
          class="flex min-w-0 items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5 text-[11px] ring-1 ring-[#c9a463]/25"
          :initial="reduced ? false : { opacity: 0, scale: 0.8 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="{ type: 'spring', stiffness: 320, damping: 18, delay: 1.4 + index * 0.15 }"
        >
          <UIcon
            :name="title.icon"
            class="size-3.5 shrink-0"
            :class="title.tone"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-[#f6e7c4]">{{ title.label }}</span>
            <span class="block truncate text-[#f6e7c4]/60">{{ title.who }} · {{ title.detail }}</span>
          </span>
        </motion.div>
        <p
          v-for="row in others"
          :key="row.index"
          class="col-span-2 flex justify-between px-1 text-[11px] text-[#f6e7c4]/60"
        >
          <span>{{ ranking.indexOf(row) + 1 }}. {{ row.name }}</span>
          <span class="tabular-nums">{{ row.total }}</span>
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap justify-center gap-3 short:mt-3">
      <PlayGameButton
        to="/dashboard"
        label="Retour à l’atelier"
        :size="isShort ? 'md' : 'lg'"
      />
      <PlayGameButton
        to="/statistiques"
        label="Mes statistiques"
        icon="i-lucide-chart-no-axes-combined"
        :size="isShort ? 'md' : 'lg'"
      />
      <PlayGameButton
        to="/play"
        label="Nouvelle table"
        icon="i-lucide-spade"
        variant="gold"
        :size="isShort ? 'md' : 'lg'"
      />
    </div>
  </section>
</template>

<style scoped>
.podium-confetti {
  position: absolute;
  top: -12px;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  opacity: 0;
  animation: podium-fall 2.8s cubic-bezier(.3, .6, .4, 1) infinite;
}
@keyframes podium-fall {
  0% { opacity: 0; transform: translateY(0) rotate(0); }
  10% { opacity: 1; }
  100% { opacity: 0; transform: translateY(340px) rotate(540deg); }
}
</style>
