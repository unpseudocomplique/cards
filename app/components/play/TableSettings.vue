<script setup lang="ts">
import { AMBIANCE_CHOICES } from '~/utils/ambianceThemes'

const { themeId, setTheme } = usePlayAmbiance()
const fullscreen = useTableFullscreen()
const tableSound = useTableSound()
const soundSettings = tableSound.settings

const volumePercent = computed({
  get: () => Math.round(soundSettings.value.volume * 100),
  set: (value: number) => tableSound.update({ volume: value / 100 })
})

/* A short sample after moving the slider, so the level can be judged by ear. */
let previewTimer: ReturnType<typeof setTimeout> | undefined
function previewVolume() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => tableSound.play('preview'), 120)
}
onBeforeUnmount(() => clearTimeout(previewTimer))

function toggleSound() {
  tableSound.update({ sound: !soundSettings.value.sound })
  if (soundSettings.value.sound) {
    tableSound.play('preview')
  }
}

function toggleVibrate() {
  tableSound.update({ vibrate: !soundSettings.value.vibrate })
  tableSound.vibrate('turn')
}

const open = shallowRef(false)
const root = ref<HTMLElement | null>(null)

onClickOutside(root, () => {
  open.value = false
})
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <PlayRoundButton
      icon="i-lucide-settings-2"
      label="Réglages de la table"
      :active="open"
      :aria-expanded="open"
      @click="open = !open"
    />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 scale-95 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute top-full right-0 z-50 mt-2 max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto overscroll-contain rounded-xl table-menu p-1.5"
        aria-label="Réglages de la table"
      >
        <button
          v-if="fullscreen.supported.value"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
          @click="fullscreen.toggle()"
        >
          <UIcon
            :name="fullscreen.active.value ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            class="size-4 shrink-0 text-amber-300"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-white">{{ fullscreen.active.value ? 'Quitter le plein écran' : 'Plein écran' }}</span>
            <span class="block truncate text-xs text-white/50">Automatique en paysage sur téléphone</span>
          </span>
        </button>
        <p
          v-else-if="fullscreen.iosBrowser.value"
          class="px-2 py-1.5 text-xs leading-snug text-white/60"
        >
          <UIcon
            name="i-lucide-maximize"
            class="mr-1 size-3.5 align-[-2px] text-amber-300"
          />
          Plein écran sur iPhone : Partager, puis « Sur l’écran d’accueil », et ouvrez Cards depuis l’icône.
        </p>
        <div class="my-1 h-px bg-white/10" />
        <p class="px-2 pt-1 pb-1 text-[10px] tracking-[0.12em] text-white/50 uppercase">
          Son
        </p>
        <button
          type="button"
          role="switch"
          :aria-checked="soundSettings.sound"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
          @click="toggleSound"
        >
          <UIcon
            :name="soundSettings.sound ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
            class="size-4 shrink-0"
            :class="soundSettings.sound ? 'text-amber-300' : 'text-white/40'"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Sons de la table</span>
            <span class="block truncate text-xs text-white/50">Cartes, plis, votre tour, fin de donne</span>
          </span>
          <span
            class="switch"
            :class="{ 'switch--on': soundSettings.sound }"
            aria-hidden="true"
          />
        </button>
        <div
          class="flex items-center gap-2.5 px-2 py-1.5 transition"
          :class="soundSettings.sound ? '' : 'pointer-events-none opacity-40'"
        >
          <UIcon
            name="i-lucide-volume-1"
            class="size-4 shrink-0 text-white/50"
          />
          <input
            v-model.number="volumePercent"
            type="range"
            min="0"
            max="100"
            step="5"
            class="volume"
            :style="{ '--fill': `${volumePercent}%` }"
            aria-label="Volume des sons"
            :disabled="!soundSettings.sound"
            @change="previewVolume"
          >
          <span class="w-9 shrink-0 text-right text-xs text-white/60 tabular-nums">{{ volumePercent }} %</span>
        </div>
        <button
          v-if="tableSound.canVibrate.value"
          type="button"
          role="switch"
          :aria-checked="soundSettings.vibrate"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
          @click="toggleVibrate"
        >
          <UIcon
            name="i-lucide-vibrate"
            class="size-4 shrink-0"
            :class="soundSettings.vibrate ? 'text-amber-300' : 'text-white/40'"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Vibrations</span>
            <span class="block truncate text-xs text-white/50">Votre tour, fin de donne</span>
          </span>
          <span
            class="switch"
            :class="{ 'switch--on': soundSettings.vibrate }"
            aria-hidden="true"
          />
        </button>
        <div class="my-1 h-px bg-white/10" />
        <p class="px-2 pt-1 pb-1.5 text-[10px] tracking-[0.12em] text-white/50 uppercase">
          Tapis
        </p>
        <div
          role="radiogroup"
          aria-label="Tapis de la table"
        >
          <button
            v-for="choice in AMBIANCE_CHOICES"
            :key="choice.id"
            type="button"
            role="radio"
            :aria-checked="themeId === choice.id"
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
            :class="themeId === choice.id ? 'bg-white/10' : ''"
            @click="setTheme(choice.id)"
          >
            <UIcon
              :name="themeId === choice.id ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
              class="size-4 shrink-0"
              :class="themeId === choice.id ? 'text-amber-300' : 'text-white/40'"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-white">{{ choice.label }}</span>
              <span class="block truncate text-xs text-white/50">{{ choice.hint }}</span>
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.switch {
  position: relative;
  width: 30px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
  transition: background 150ms;
}
.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: #f6e7c4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  transition: transform 150ms ease-out;
}
.switch--on { background: #c9a463; }
.switch--on::after { transform: translateX(12px); }

.volume {
  flex: 1;
  min-width: 0;
  height: 18px;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.volume::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 9999px;
  background: linear-gradient(to right, #e0c06a var(--fill), rgba(255, 255, 255, 0.18) var(--fill));
}
.volume::-moz-range-track {
  height: 4px;
  border-radius: 9999px;
  background: linear-gradient(to right, #e0c06a var(--fill), rgba(255, 255, 255, 0.18) var(--fill));
}
.volume::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff3cf, #c9a463 70%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.volume::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff3cf, #c9a463 70%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.volume:focus-visible { outline: 2px solid #ffe7a8; outline-offset: 3px; border-radius: 4px; }
</style>
