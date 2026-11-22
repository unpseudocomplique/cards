<script setup lang="ts">
import { AMBIANCE_CHOICES } from '~/utils/ambianceThemes'

const { themeId, setTheme } = usePlayAmbiance()

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
    <UButton
      icon="i-lucide-settings-2"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      class="rounded-lg bg-black/40 text-white/80 ring-1 ring-white/10 backdrop-blur-md hover:bg-black/60 hover:text-white"
      :class="open ? 'bg-black/70 text-white ring-white/30' : ''"
      :aria-expanded="open"
      aria-label="Réglages de la table"
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
        class="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl bg-neutral-950/92 p-1.5 shadow-2xl ring-1 ring-white/15 backdrop-blur-md"
        role="radiogroup"
        aria-label="Ambiance de la pièce"
      >
        <p class="px-2 pt-1 pb-1.5 text-[10px] tracking-[0.12em] text-white/50 uppercase">
          Ambiance
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
