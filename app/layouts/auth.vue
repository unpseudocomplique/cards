<script setup lang="ts">
import { getCardTheme } from '~~/shared/utils/cardThemes'

const img = useImage()

const fan = [
  { src: '/salon-cast/lea.png', index: 'D♥', red: true, theme: 'royal' },
  { src: '/salon-cast/hassan.png', index: 'R♠', red: false, theme: 'nuit' },
  { src: '/salon-cast/nadege.png', index: '21', red: false, theme: 'atelier' }
].map(card => ({
  ...card,
  src: img(card.src, { width: 420, format: 'webp' }),
  theme: getCardTheme(card.theme)
}))
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <div class="flex flex-col px-4 py-6 sm:px-8">
      <div class="flex items-center justify-between">
        <AppLogo />
        <UColorModeButton
          color="neutral"
          variant="ghost"
        />
      </div>
      <div class="flex flex-1 items-center justify-center py-10">
        <div class="w-full max-w-sm">
          <slot />
        </div>
      </div>
    </div>

    <aside
      class="relative hidden flex-col overflow-hidden bg-neutral-950 lg:flex"
      aria-hidden="true"
    >
      <div class="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,var(--color-violet-900)_0%,transparent_75%)]" />
      <div class="absolute inset-0 bg-felt opacity-15" />
      <div class="relative flex min-h-0 flex-1 items-center justify-center pt-12">
        <div class="relative w-40 xl:w-48">
          <CardArt
            v-for="(card, index) in fan"
            :key="card.src"
            :image="card.src"
            :index="card.index"
            :red="card.red"
            :theme="card.theme"
            class="shadow-2xl shadow-black/70"
            :class="index === 1 ? 'relative z-10' : 'absolute inset-0'"
            :style="{
              transform: `translateX(${(index - 1) * 58}%) translateY(${Math.abs(index - 1) * 6}%) rotate(${(index - 1) * 10}deg)`
            }"
          />
        </div>
      </div>
      <div class="relative p-10 xl:p-14">
        <p class="max-w-md font-display text-4xl leading-tight text-white">
          Un tarot dont les figures ont vos visages.
        </p>
        <p class="mt-3 text-sm text-white/60">
          Créez le jeu à partir de vos photos, puis jouez-le en ligne à 3, 4 ou 5.
        </p>
      </div>
    </aside>
  </div>
</template>
