import type { NavigationMenuItem } from '@nuxt/ui'

export const navLinks: NavigationMenuItem[] = [{
  label: 'Accueil',
  icon: 'i-lucide-house',
  to: '/'
}, {
  label: 'Jouer',
  icon: 'i-lucide-spade',
  to: '/play'
}, {
  label: 'Mes decks',
  icon: 'i-lucide-layers',
  to: '/dashboard'
}, {
  label: 'Nouveau deck',
  icon: 'i-lucide-plus',
  to: '/decks/new'
}]
