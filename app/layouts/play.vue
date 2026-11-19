<template>
  <div class="play-layout dark min-h-dvh bg-neutral-950 text-default">
    <slot />
  </div>
</template>

<style>
/*
 * The game table uses tighter corners than the rest of the app: Nuxt UI
 * derives every radius from --ui-radius (xl = 3×), which made chips and
 * panels look like pills over the table.
 */
.play-layout {
  --ui-radius: 0.25rem;
  --radius-xs: calc(var(--ui-radius) * 0.5);
  --radius-sm: var(--ui-radius);
  --radius-md: calc(var(--ui-radius) * 1.5);
  --radius-lg: calc(var(--ui-radius) * 2);
  --radius-xl: calc(var(--ui-radius) * 3);
  --radius-2xl: calc(var(--ui-radius) * 4);
  --radius-3xl: calc(var(--ui-radius) * 6);
}
</style>
