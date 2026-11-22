<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'
import type { TableEmote } from '~~/shared/play/emotes'

/**
 * Corners of the table: leave (top left), the score plaque (top centre on
 * upright phones, beside the leave button elsewhere), reactions and settings
 * (top right, clear of the score notebook).
 */
defineProps<{
  state: PublicGameView
  localSeat: number | null
  degraded?: boolean
  /** Game socket down: the app is reconnecting on its own. */
  offline?: boolean
  /** The local player holds the called king: the taker's (secret) partner. */
  calledPartner?: boolean
}>()

const emit = defineEmits<{
  leave: []
  scores: []
  emote: [emote: TableEmote]
}>()
</script>

<template>
  <div class="hud pointer-events-none">
    <div class="hud-left pointer-events-auto">
      <PlayRoundButton
        icon="i-lucide-log-out"
        label="Quitter la table"
        class="[&_svg]:rotate-180"
        @click="emit('leave')"
      />
    </div>

    <div class="hud-plaque pointer-events-auto">
      <PlayScorePlaque
        :state="state"
        :local-seat="localSeat"
        :called-partner="calledPartner"
        @scores="emit('scores')"
      />
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="scale-75 opacity-0"
      >
        <span
          v-if="calledPartner && state.partnerSeat == null"
          class="mt-1.5 flex items-center gap-1 rounded-full bg-[#2f8fb0] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md ring-1 ring-[#f2d79a]"
          title="Vous avez le roi appelé : vous jouez avec le preneur. Les autres ne le savent pas encore."
        >
          <UIcon
            name="i-lucide-handshake"
            class="size-3.5"
          />
          Vous êtes appelé
        </span>
      </Transition>
    </div>

    <div class="hud-right pointer-events-auto">
      <span
        v-if="offline"
        class="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-100 ring-1 ring-amber-300/40 backdrop-blur-sm"
        role="status"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-3.5 animate-spin"
        />
        Reconnexion…
      </span>
      <UTooltip
        v-else-if="degraded"
        text="Synchronisation partielle : la partie continue via le serveur de jeu."
      >
        <div class="grid size-8 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-300/30">
          <UIcon
            name="i-lucide-wifi-off"
            class="size-4"
          />
        </div>
      </UTooltip>
      <PlayEmotePicker
        v-if="localSeat !== null"
        @send="emit('emote', $event)"
      />
      <PlayTableSettings />
    </div>
  </div>
</template>

<style scoped>
.hud { position: relative; height: 0; }
.hud-left { position: absolute; left: 0; top: 0; }
.hud-plaque {
  position: absolute;
  top: calc(-1 * max(0.75rem, env(safe-area-inset-top)));
  left: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hud-right {
  position: absolute;
  top: 0;
  right: 78px;
  display: flex;
  align-items: center;
  gap: 12px;
}
/* Upright phones: plaque in the middle, buttons in the corner (the notebook is lower down). */
@media (max-aspect-ratio: 17 / 20) {
  .hud-plaque { left: 50%; transform: translateX(-50%); }
  .hud-right { right: 0; flex-direction: column; align-items: flex-end; }
}
@media (max-height: 520px) {
  .hud-plaque { top: calc(-1 * max(0.5rem, env(safe-area-inset-top))); }
  .hud-right { right: 64px; }
}
</style>
