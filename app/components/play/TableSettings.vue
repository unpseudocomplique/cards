<script setup lang="ts">
import { AMBIANCE_CHOICES } from '~/utils/ambianceThemes'

const { themeId, setTheme } = usePlayAmbiance()
const fullscreen = useTableFullscreen()
const installApp = useInstallApp()

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
        class="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl table-menu p-1.5"
        role="radiogroup"
        aria-label="Tapis de la table"
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
        <button
          v-else-if="fullscreen.iosBrowser.value"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
          @click="open = false; installApp.sheetOpen.value = true"
        >
          <UIcon
            name="i-lucide-maximize"
            class="size-4 shrink-0 text-amber-300"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-white">Plein écran</span>
            <span class="block text-xs leading-snug text-white/50">Sur iPhone, ajoutez Cards à l’écran d’accueil</span>
          </span>
        </button>
        <div class="my-1 h-px bg-white/10" />
        <p class="px-2 pt-1 pb-1.5 text-[10px] tracking-[0.12em] text-white/50 uppercase">
          Tapis
        </p>
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
    </Transition>
  </div>
</template>
