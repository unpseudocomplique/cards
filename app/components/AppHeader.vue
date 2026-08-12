<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  links: NavigationMenuItem[]
}>()

const { loggedIn, user } = useUserSession()
const route = useRoute()
const menuOpen = shallowRef(false)

watch(() => route.fullPath, () => {
  menuOpen.value = false
})
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-40">
    <div class="px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-2xl border border-default/80 bg-default/75 px-2 shadow-[0_12px_40px_-18px_oklch(0.2_0.03_40_/_0.55)] backdrop-blur-md sm:px-3">
        <AppWordmark compact />
        <AppWordmark />

        <nav
          class="ml-2 hidden min-w-0 flex-1 items-center justify-center md:flex"
          aria-label="Navigation principale"
        >
          <UNavigationMenu
            :items="links"
            variant="link"
            color="neutral"
            class="justify-center"
            :ui="{
              link: 'px-2.5 py-1 text-sm',
              linkLeadingIcon: 'hidden'
            }"
          />
        </nav>

        <div class="ml-auto flex items-center gap-0.5">
          <UButton
            to="/play"
            size="sm"
            icon="i-lucide-spade"
            class="min-h-11 md:hidden"
            aria-label="Jouer au tarot"
          >
            Jouer
          </UButton>
          <ColorModeButton />
          <div class="hidden sm:flex">
            <UButton
              v-if="loggedIn"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-log-out"
              to="/auth/logout"
              external
              class="min-h-11 min-w-11"
              :aria-label="`Déconnecter ${user?.username || 'le compte'}`"
            />
            <UButton
              v-else
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-log-in"
              to="/auth/login"
              class="min-h-11"
            >
              Connexion
            </UButton>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-menu"
            class="min-h-11 min-w-11 md:hidden"
            aria-label="Ouvrir le menu"
            @click="menuOpen = true"
          />
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="menuOpen"
      title="Menu"
      description="Navigation"
      side="right"
      :ui="{
        overlay: 'bg-ink-950/50',
        content: 'max-w-xs'
      }"
    >
      <template #body>
        <nav
          class="flex flex-col gap-1"
          aria-label="Menu mobile"
        >
          <UButton
            v-for="link in links"
            :key="String(link.to)"
            :to="link.to"
            :icon="typeof link.icon === 'string' ? link.icon : undefined"
            color="neutral"
            variant="ghost"
            class="w-full justify-start"
            size="lg"
          >
            {{ link.label }}
          </UButton>
        </nav>
      </template>
      <template #footer>
        <UButton
          v-if="loggedIn"
          to="/auth/logout"
          external
          color="neutral"
          variant="outline"
          icon="i-lucide-log-out"
          block
          class="justify-center"
        >
          Déconnexion
        </UButton>
        <UButton
          v-else
          to="/auth/login"
          icon="i-lucide-log-in"
          block
          class="justify-center"
        >
          Connexion
        </UButton>
      </template>
    </USlideover>
  </header>
</template>
