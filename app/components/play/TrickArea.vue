<script setup lang="ts">
import type { CardId, PublicSeatInfo } from '~~/shared/tarot'

defineProps<{
  trick: Array<{ seat: number, card: CardId }>
  seats: PublicSeatInfo[]
  currentSeat?: number
}>()

function seatName(seats: PublicSeatInfo[], seatId: number) {
  return seats.find(seat => seat.seatId === seatId)?.name || `Siège ${seatId + 1}`
}
</script>

<template>
  <UCard>
    <template #header>
      <p class="font-semibold text-highlighted">
        Pli en cours
      </p>
      <p
        v-if="currentSeat !== undefined"
        class="text-sm text-muted"
      >
        À jouer : {{ seatName(seats, currentSeat) }}
      </p>
    </template>

    <div
      v-if="trick.length"
      class="flex flex-wrap justify-center gap-4"
    >
      <div
        v-for="entry in trick"
        :key="`${entry.seat}-${entry.card}`"
        class="flex flex-col items-center gap-2"
      >
        <PlayCardFace :card-id="entry.card" />
        <span class="text-xs text-muted">{{ seatName(seats, entry.seat) }}</span>
      </div>
    </div>

    <p
      v-else
      class="text-center text-sm text-muted"
    >
      Aucune carte jouée pour l'instant.
    </p>
  </UCard>
</template>
