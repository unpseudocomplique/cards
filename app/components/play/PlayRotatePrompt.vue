<script setup lang="ts">
const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-neutral-950 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
    <div
      class="phone-tilt mb-10 h-28 w-16 rounded-[1.1rem] border-2 border-primary/70 bg-neutral-900 p-1.5 shadow-[0_0_40px_-8px_var(--ui-primary)]"
      aria-hidden="true"
    >
      <div class="size-full rounded-[0.7rem] bg-emerald-900/80" />
    </div>
    <h1 class="font-display text-4xl text-highlighted">
      Tournez votre téléphone
    </h1>
    <p class="mt-3 max-w-[32ch] text-sm text-muted">
      La table se joue en paysage, pour garder le tapis et votre main sous les yeux.
    </p>
    <UButton
      class="mt-8"
      label="C’est fait"
      color="neutral"
      variant="subtle"
      @click="emit('retry')"
    />
    <UButton
      to="/play"
      label="Quitter la table"
      color="neutral"
      variant="link"
      class="mt-2"
    />
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .phone-tilt {
    animation: tilt-phone 2.2s ease-in-out infinite;
  }
}

@keyframes tilt-phone {
  0%, 20% { transform: rotate(0deg); }
  50%, 75% { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}
</style>
