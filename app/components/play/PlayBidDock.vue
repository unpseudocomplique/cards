<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { contractLabels, contractRank, contracts } from '~/utils/tarotContracts'

/**
 * Bidding, in the middle of the cloth: who is thinking, the bid to beat, and
 * on your turn one table button per contract you may still say. What each
 * player said shows under their portrait (SeatMedallions).
 */
const props = defineProps<{
  state: PublicGameView
  myTurn: boolean
  localSeat: number | null
}>()

const emit = defineEmits<{
  bid: [bid: Contract | 'passe']
}>()

const highest = computed<Contract | null>(() => {
  const bids = (props.state.bidSpoken ?? []).filter(entry => entry.bid !== 'passe')
  return (bids.at(-1)?.bid as Contract | undefined) ?? null
})

const highestBy = computed(() => {
  const entry = [...(props.state.bidSpoken ?? [])].reverse().find(item => item.bid !== 'passe')
  return entry ? seatName(entry.seat) : null
})

const open = computed(() => contracts.filter(contract => !highest.value || contractRank[contract] > contractRank[highest.value]))

function seatName(seat: number) {
  if (seat === props.localSeat) {
    return 'Vous'
  }
  return props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const variants: Record<Contract, 'felt' | 'gold' | 'wine' | 'ink'> = {
  prise: 'felt',
  garde: 'gold',
  garde_sans: 'wine',
  garde_contre: 'ink'
}

const isShort = useMediaQuery('(max-height: 520px)')
const isNarrow = useMediaQuery('(max-width: 420px)')
const buttonSize = computed(() => isShort.value || isNarrow.value ? 'md' : 'lg')
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <Transition
      mode="out-in"
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="myTurn"
        key="mine"
        class="flex flex-col items-center"
      >
        <p class="font-display text-3xl leading-none text-[#f6e7c4] [text-shadow:0_2px_8px_rgba(0,0,0,.8)] short:text-2xl">
          À vous de parler
        </p>
        <p class="mt-1 text-xs text-[#f6e7c4]/70 [text-shadow:0_1px_3px_#000]">
          <template v-if="highest">
            {{ highestBy }} {{ highestBy === 'Vous' ? 'avez' : 'a' }} dit {{ contractLabels[highest] }}
          </template>
          <template v-else>
            Personne n’a encore pris
          </template>
        </p>
        <div class="mt-3 flex max-w-[min(36rem,94vw)] flex-wrap justify-center gap-x-2.5 gap-y-3 short:mt-2">
          <PlayGameButton
            label="Passe"
            :size="buttonSize"
            @click="emit('bid', 'passe')"
          />
          <PlayGameButton
            v-for="contract in open"
            :key="contract"
            :label="contractLabels[contract]"
            :variant="variants[contract]"
            :size="buttonSize"
            @click="emit('bid', contract)"
          />
        </div>
      </div>
      <p
        v-else
        key="wait"
        class="flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-1.5 text-sm text-[#f6e7c4]/85 ring-1 ring-[#c9a463]/40 backdrop-blur-sm"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
        {{ seatName(state.currentSeat) }} réfléchit…
        <span
          v-if="highest"
          class="text-[#f6e7c4]/55"
        >· à battre : {{ contractLabels[highest] }}</span>
      </p>
    </Transition>
  </div>
</template>
