<script setup lang="ts">
const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-gold-100">
    <div
      class="phone-tilt mb-8 h-28 w-16 rounded-[1.35rem] border-2 border-gold-400/70 bg-ink-900 shadow-[inset_0_1px_0_oklch(1_0_0_/_0.08)]"
      aria-hidden="true"
    >
      <div class="mx-auto mt-2 h-1.5 w-8 rounded-full bg-gold-400/40" />
    </div>
    <h1 class="font-serif text-3xl tracking-tight text-gold-50">
      Tournez votre téléphone
    </h1>
    <p class="mt-3 max-w-[32ch] text-sm leading-relaxed text-gold-100/70">
      La table de tarot se joue en paysage, pour garder le tapis, la main et les enchères devant vous.
    </p>
    <UButton
      class="mt-8"
      color="primary"
      variant="outline"
      @click="emit('retry')"
    >
      C’est fait
    </UButton>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .phone-tilt {
    animation: tilt-phone 1.8s ease-in-out infinite;
  }
}

@keyframes tilt-phone {
  0%, 20% { transform: rotate(0deg); }
  50%, 70% { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}
</style>
