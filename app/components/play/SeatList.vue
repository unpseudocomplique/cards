<script setup lang="ts">
import type { PublicSeatInfo } from '~~/shared/tarot'

defineProps<{
  seats: PublicSeatInfo[]
  hostSeatId?: number
  showHostControls?: boolean
}>()

const emit = defineEmits<{
  removeBot: [seat: number]
}>()
</script>

<template>
  <ul class="space-y-2">
    <li
      v-for="seat in seats"
      :key="seat.seatId"
      class="flex items-center justify-between gap-3 rounded-lg border border-default bg-default px-3 py-2"
    >
      <div class="min-w-0">
        <p class="truncate font-medium text-highlighted">
          Siège {{ seat.seatId + 1 }}
          <span
            v-if="hostSeatId === seat.seatId"
            class="text-muted"
          >· Hôte</span>
        </p>
        <p class="truncate text-sm text-muted">
          {{ seat.userId ? (seat.name || 'Joueur') : 'Libre' }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UBadge
          :color="seat.controlledBy === 'bot' ? 'info' : seat.userId ? 'success' : 'neutral'"
          variant="subtle"
        >
          {{
            seat.controlledBy === 'bot'
              ? 'Bot'
              : seat.userId
                ? (seat.connected ? 'Connecté' : 'Absent')
                : 'Vide'
          }}
        </UBadge>

        <UButton
          v-if="showHostControls && seat.controlledBy === 'bot'"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-user-minus"
          aria-label="Retirer le bot"
          @click="emit('removeBot', seat.seatId)"
        />
      </div>
    </li>
  </ul>
</template>
