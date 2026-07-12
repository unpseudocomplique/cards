<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  links: NavigationMenuItem[]
}>()

const { loggedIn, user } = useUserSession()
</script>

<template>
  <div class="fixed top-2 left-1/2 z-10 w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 transform sm:top-4">
    <UNavigationMenu
      :items="links"
      variant="link"
      color="neutral"
      class="justify-center overflow-x-auto rounded-full border border-muted/50 bg-muted/80 px-2 shadow-lg shadow-neutral-950/5 backdrop-blur-sm sm:px-4"
      :ui="{
        root: 'min-w-0',
        list: 'flex-nowrap',
        link: 'shrink-0 px-2 py-1 text-sm',
        linkLeadingIcon: 'hidden'
      }"
    >
      <template #list-trailing>
        <div class="flex items-center gap-1">
          <ColorModeButton />
          <UButton
            v-if="loggedIn"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-log-out"
            to="/auth/logout"
            external
            :aria-label="`Déconnecter ${user?.username || 'le compte'}`"
          />
          <UButton
            v-else
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-log-in"
            to="/auth/login"
            aria-label="Se connecter"
          />
        </div>
      </template>
    </UNavigationMenu>
  </div>
</template>
