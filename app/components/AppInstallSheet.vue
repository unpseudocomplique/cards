<script setup lang="ts">
/**
 * "Installer Cards" sheet, mounted once in app.vue and opened from anywhere
 * through useInstallApp().sheetOpen. Shows the steps for this device.
 */
const { platform, standalone, canPrompt, sheetOpen, install } = useInstallApp()

interface Step {
  icon: string
  text: string
  hint?: string
}

const steps = computed<Step[]>(() => {
  switch (platform.value) {
    case 'ios-safari':
      return [
        { icon: 'i-lucide-share', text: 'Touchez Partager dans la barre de Safari.', hint: 'Sur iOS 26, touchez d’abord ••• en bas à droite.' },
        { icon: 'i-lucide-square-plus', text: 'Choisissez « Sur l’écran d’accueil ».', hint: 'Faites défiler la liste si besoin, ou touchez « Plus ».' },
        { icon: 'i-lucide-check', text: 'Laissez « Ouvrir comme app web » activé, puis touchez « Ajouter ».' },
        { icon: 'i-lucide-spade', text: 'Ouvrez Cards depuis sa nouvelle icône.' }
      ]
    case 'ios-other':
      return [
        { icon: 'i-lucide-share', text: 'Touchez Partager dans la barre d’adresse.', hint: 'Dans Chrome, en haut à droite à côté de l’adresse.' },
        { icon: 'i-lucide-square-plus', text: 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».', hint: 'Option absente ? Ouvrez cette page dans Safari.' },
        { icon: 'i-lucide-spade', text: 'Ouvrez Cards depuis sa nouvelle icône.' }
      ]
    case 'android':
      return [
        { icon: 'i-lucide-ellipsis-vertical', text: 'Ouvrez le menu ⋮ du navigateur.' },
        { icon: 'i-lucide-square-plus', text: 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».' },
        { icon: 'i-lucide-spade', text: 'Ouvrez Cards depuis sa nouvelle icône.' }
      ]
    default:
      return [
        { icon: 'i-lucide-monitor-down', text: 'Dans Chrome ou Edge, cliquez sur l’icône d’installation au bout de la barre d’adresse.' },
        { icon: 'i-lucide-smartphone', text: 'Pour le téléphone, ouvrez ce site sur le téléphone et revenez sur cet écran.' }
      ]
  }
})

const perks = [
  { icon: 'i-lucide-maximize', text: 'Plein écran, même en paysage sur iPhone' },
  { icon: 'i-lucide-layout-grid', text: 'Une icône sur l’écran d’accueil, comme une appli' },
  { icon: 'i-lucide-zap', text: 'Ouvre directement les tables de tarot' }
]
</script>

<template>
  <UModal
    v-model:open="sheetOpen"
    :title="standalone ? 'Cards est installé' : 'Installer Cards'"
    description="Sur l’écran d’accueil, Cards s’ouvre comme une vraie appli."
    :ui="{ content: 'max-w-md', body: 'space-y-5' }"
  >
    <template #body>
      <div class="flex items-center gap-4">
        <img
          src="/apple-touch-icon.png"
          alt=""
          width="64"
          height="64"
          class="size-16 shrink-0 rounded-[22%] shadow-lg shadow-black/40"
        >
        <ul class="min-w-0 space-y-1.5 text-sm">
          <li
            v-for="perk in perks"
            :key="perk.text"
            class="flex items-start gap-2"
          >
            <UIcon
              :name="perk.icon"
              class="mt-0.5 size-4 shrink-0 text-primary"
            />
            <span>{{ perk.text }}</span>
          </li>
        </ul>
      </div>

      <div
        v-if="standalone"
        class="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-5 shrink-0"
        />
        Vous utilisez déjà l’appli. Bon jeu !
      </div>

      <template v-else>
        <UButton
          v-if="canPrompt"
          label="Installer maintenant"
          icon="i-lucide-download"
          size="lg"
          block
          @click="install()"
        />

        <div>
          <p
            v-if="canPrompt"
            class="mb-2 text-xs text-dimmed"
          >
            Ou depuis le navigateur :
          </p>
          <ol class="space-y-3">
            <li
              v-for="(step, index) in steps"
              :key="step.text"
              class="flex gap-3"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated ring ring-default">
                <UIcon
                  :name="step.icon"
                  class="size-4 text-highlighted"
                  :aria-label="`Étape ${index + 1}`"
                />
              </span>
              <span class="min-w-0 pt-1 text-sm">
                <span class="text-highlighted">{{ step.text }}</span>
                <span
                  v-if="step.hint"
                  class="mt-0.5 block text-xs text-muted"
                >{{ step.hint }}</span>
              </span>
            </li>
          </ol>
        </div>
      </template>
    </template>
  </UModal>
</template>
