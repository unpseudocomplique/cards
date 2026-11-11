<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { user } = useUserSession()
const colorMode = useColorMode()

const items = computed<DropdownMenuItem[][]>(() => [
  [{
    type: 'label',
    label: user.value?.username || 'Compte',
    description: user.value?.email,
    avatar: {
      src: user.value?.picture || undefined,
      alt: user.value?.username
    }
  }],
  [{
    label: 'Apparence',
    icon: colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun',
    children: [{
      label: 'Clair',
      icon: 'i-lucide-sun',
      type: 'checkbox',
      checked: colorMode.preference === 'light',
      onSelect(event: Event) {
        event.preventDefault()
        colorMode.preference = 'light'
      }
    }, {
      label: 'Sombre',
      icon: 'i-lucide-moon',
      type: 'checkbox',
      checked: colorMode.preference === 'dark',
      onSelect(event: Event) {
        event.preventDefault()
        colorMode.preference = 'dark'
      }
    }, {
      label: 'Système',
      icon: 'i-lucide-monitor',
      type: 'checkbox',
      checked: colorMode.preference === 'system',
      onSelect(event: Event) {
        event.preventDefault()
        colorMode.preference = 'system'
      }
    }]
  }],
  [{
    label: 'Page d’accueil',
    icon: 'i-lucide-house',
    to: '/'
  }],
  [{
    label: 'Se déconnecter',
    icon: 'i-lucide-log-out',
    to: '/auth/logout',
    external: true
  }]
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-56' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :avatar="{
        src: user?.picture || undefined,
        alt: user?.username || 'Compte'
      }"
      :label="collapsed ? undefined : user?.username"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
