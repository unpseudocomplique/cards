<script setup lang="ts">
/**
 * Small invitation to put Cards on the home screen, shown on phones and
 * tablets that have not installed it yet. "Plus tard" hides it for 3 weeks.
 */
const { shouldInvite, platform, install, dismiss } = useInstallApp()

const message = computed(() => platform.value.startsWith('ios')
  ? 'Ajoutez Cards à l’écran d’accueil pour jouer en plein écran, même en paysage.'
  : 'Installez Cards pour jouer en plein écran et l’ouvrir d’un geste.')
</script>

<template>
  <ClientOnly>
    <div
      v-if="shouldInvite"
      class="flex items-center gap-3 rounded-xl bg-elevated/60 p-3 ring ring-default"
    >
      <img
        src="/icon-192.png"
        alt=""
        width="40"
        height="40"
        class="size-10 shrink-0 rounded-[22%]"
      >
      <p class="min-w-0 flex-1 text-sm text-toned">
        <span class="block font-medium text-highlighted">Cards sur votre téléphone</span>
        {{ message }}
      </p>
      <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        <UButton
          label="Installer"
          size="sm"
          @click="install()"
        />
        <UButton
          label="Plus tard"
          size="xs"
          color="neutral"
          variant="link"
          @click="dismiss()"
        />
      </div>
    </div>
  </ClientOnly>
</template>
