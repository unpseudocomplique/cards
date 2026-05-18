<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  links: NavigationMenuItem[]
}>()

const { loggedIn, user } = useUserSession()
</script>

<template>
  <div class="fixed top-2 sm:top-4 mx-auto left-1/2 transform -translate-x-1/2 z-10 w-[calc(100%-1rem)] max-w-3xl">
    <UNavigationMenu
      :items="links"
      variant="link"
      color="neutral"
      class="bg-muted/80 backdrop-blur-sm rounded-full px-2 sm:px-4 border border-muted/50 shadow-lg shadow-neutral-950/5 justify-center"
      :ui="{
        link: 'px-2 py-1',
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
