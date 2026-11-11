<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { loggedIn } = useUserSession()
const { app } = useAppConfig()

const links: NavigationMenuItem[] = [{
  label: 'Comment ça marche',
  to: '/#etapes'
}, {
  label: 'La table',
  to: '/#table'
}, {
  label: 'Impression',
  to: '/#impression'
}]
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <UHeader
      mode="slideover"
      :ui="{ root: 'bg-default/70 backdrop-blur-lg border-b border-default/60' }"
    >
      <!-- #left replaces UHeader's own title link (AppLogo is already a link). -->
      <template #left>
        <AppLogo />
      </template>

      <UNavigationMenu
        :items="links"
        variant="link"
        color="neutral"
      />

      <template #right>
        <UColorModeButton
          color="neutral"
          variant="ghost"
        />
        <UButton
          v-if="loggedIn"
          to="/dashboard"
          label="Mon atelier"
          trailing-icon="i-lucide-arrow-right"
        />
        <template v-else>
          <UButton
            to="/auth/login"
            label="Connexion"
            color="neutral"
            variant="ghost"
            class="hidden sm:inline-flex"
          />
          <UButton
            to="/auth/register"
            label="Créer un compte"
          />
        </template>
      </template>

      <template #body>
        <UNavigationMenu
          :items="links"
          orientation="vertical"
          class="-mx-2.5"
        />
        <USeparator class="my-4" />
        <div class="flex flex-col gap-2">
          <UButton
            v-if="loggedIn"
            to="/dashboard"
            label="Mon atelier"
            block
          />
          <template v-else>
            <UButton
              to="/auth/register"
              label="Créer un compte"
              block
            />
            <UButton
              to="/auth/login"
              label="Connexion"
              color="neutral"
              variant="subtle"
              block
            />
          </template>
        </div>
      </template>
    </UHeader>

    <UMain class="flex-1">
      <slot />
    </UMain>

    <UFooter :ui="{ root: 'border-t border-default/60' }">
      <template #left>
        <p class="text-sm text-muted">
          {{ app.name }} · {{ new Date().getFullYear() }}
        </p>
      </template>
      <template #right>
        <UButton
          to="/play"
          label="Jouer"
          color="neutral"
          variant="link"
        />
        <UButton
          to="/dashboard"
          label="Mes decks"
          color="neutral"
          variant="link"
        />
      </template>
    </UFooter>
  </div>
</template>
