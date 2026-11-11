<script setup lang="ts">
import { motion } from 'motion-v'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { CARD_FORMATS, PRINT_BLEED_MM, PRINT_DPI, formatTrimLabel } from '~~/shared/utils/printSpec'

useSeoMeta({
  title: '',
  description: 'Créez un tarot dont les figures portent les visages de vos proches, puis jouez-le en ligne à 3, 4 ou 5 joueurs ou envoyez-le à l’imprimeur.'
})

const { loggedIn } = useUserSession()
const img = useImage()
const reducedMotion = usePreferredReducedMotion()
const calm = computed(() => reducedMotion.value === 'reduce')

function portrait(name: string) {
  return img(`/salon-cast/${name}.png`, { width: 420, format: 'webp' })
}

const fan = [
  { name: 'marco', index: 'V♣', red: false, theme: 'foret' },
  { name: 'lea', index: 'D♥', red: true, theme: 'royal' },
  { name: 'aurelien', index: 'R♠', red: false, theme: 'nuit' },
  { name: 'ines', index: 'C♦', red: true, theme: 'riviera' },
  { name: 'olivier', index: '21', red: false, theme: 'atelier' }
].map((card, index, list) => {
  const offset = index - (list.length - 1) / 2
  return {
    ...card,
    image: portrait(card.name),
    theme: getCardTheme(card.theme),
    rotate: offset * 9,
    x: offset * 62,
    y: Math.abs(offset) * 14
  }
})

const fanOpen = shallowRef(false)

const steps = [{
  icon: 'i-lucide-images',
  title: 'Ajoutez les visages',
  description: 'Quelques photos par personne suffisent. Plusieurs angles aident l’IA à garder la ressemblance.'
}, {
  icon: 'i-lucide-users-round',
  title: 'Distribuez les rôles',
  description: 'Mamie en Dame de cœur, les cousins en Cavaliers, toute la bande en atouts. Par groupe ou carte par carte.'
}, {
  icon: 'i-lucide-sparkles',
  title: 'Générez le jeu',
  description: 'Un thème de couleurs unique pour les 78 cartes et le dos. Vous relancez seulement celles qui ne plaisent pas.'
}]

const tableSeats = ['hassan', 'camille', 'julien', 'sofia', 'nadege']

const tableFeatures = [{
  icon: 'i-lucide-gavel',
  title: 'Toutes les règles FFT',
  description: 'Enchères, chien, écart, appel au roi à cinq et marquage automatique.'
}, {
  icon: 'i-lucide-link',
  title: 'Une invitation, un lien',
  description: 'Partagez le code de la table, et complétez les places vides avec des bots.'
}, {
  icon: 'i-lucide-smartphone',
  title: 'Sur ordinateur ou téléphone',
  description: 'En paysage sur mobile, comme un tapis posé devant soi.'
}]

const printFeatures = [{
  icon: 'i-lucide-ruler',
  title: `${formatTrimLabel(CARD_FORMATS.tarot)}, le vrai format tarot`,
  description: `Toutes les cartes au même format, atouts et Excuse compris. Le jeu classique reste en ${formatTrimLabel(CARD_FORMATS.poker)}.`
}, {
  icon: 'i-lucide-scan',
  title: `${PRINT_DPI} DPI, fond perdu ${PRINT_BLEED_MM} mm`,
  description: 'Des fichiers prêts pour l’imprimeur, sans retouche.'
}, {
  icon: 'i-lucide-package',
  title: 'Faces, dos et fiche technique',
  description: 'Tout part dans une archive ZIP, avec un dos commun à tout le jeu.'
}]

const startLink = computed(() => loggedIn.value ? '/decks/new' : '/auth/register')

/** Fade-up on scroll; disabled when the visitor prefers reduced motion. */
function reveal(delay = 0): Record<string, unknown> {
  if (calm.value) {
    return { initial: false }
  }
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true, margin: '-10% 0px' },
    transition: { type: 'spring', stiffness: 260, damping: 28, delay }
  }
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 -z-10 bg-felt opacity-40 [mask-image:radial-gradient(70%_60%_at_70%_40%,black,transparent)]" />
      <div class="absolute top-[-20%] right-[-10%] -z-10 size-[42rem] rounded-full bg-primary/15 blur-3xl" />

      <UContainer class="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-28">
        <div>
          <UBadge
            label="Tarot français · 3 à 5 joueurs"
            color="primary"
            variant="subtle"
            icon="i-lucide-spade"
            class="rounded-full"
          />
          <h1 class="mt-6 font-display text-5xl leading-[1.02] text-balance text-highlighted sm:text-6xl lg:text-7xl">
            Le tarot, avec vos visages sur les cartes.
          </h1>
          <p class="mt-6 max-w-xl text-lg text-pretty text-muted">
            Transformez vos photos en un jeu de 78 cartes illustrées. Jouez-le en ligne avec vos proches, ou envoyez-le à l’imprimeur.
          </p>
          <div class="mt-10 flex flex-col gap-3 sm:flex-row">
            <UButton
              :to="startLink"
              size="xl"
              label="Créer mon jeu"
              trailing-icon="i-lucide-arrow-right"
              class="justify-center"
            />
            <UButton
              to="/play"
              size="xl"
              color="neutral"
              variant="subtle"
              icon="i-lucide-spade"
              label="Ouvrir une table"
              class="justify-center"
            />
          </div>
        </div>

        <div
          class="relative mx-auto flex h-[22rem] w-full max-w-md items-center justify-center sm:h-[26rem]"
          aria-hidden="true"
          @pointerenter="fanOpen = true"
          @pointerleave="fanOpen = false"
        >
          <motion.div
            v-for="(card, index) in fan"
            :key="card.name"
            class="absolute w-36 origin-bottom sm:w-44"
            :style="{ zIndex: 10 - Math.abs(index - 2) }"
            :initial="calm ? false : { opacity: 0, y: 60, rotate: 0, x: 0 }"
            :animate="{
              opacity: 1,
              x: card.x * (fanOpen ? 1.25 : 1),
              y: card.y - (fanOpen && index === 2 ? 14 : 0),
              rotate: card.rotate * (fanOpen ? 1.15 : 1)
            }"
            :transition="{ type: 'spring', stiffness: 200, damping: 22, delay: calm || fanOpen ? 0 : 0.1 + index * 0.07 }"
          >
            <CardArt
              :image="card.image"
              :index="card.index"
              :red="card.red"
              :theme="card.theme"
              class="shadow-2xl shadow-black/40 ring-1 ring-black/5"
            />
          </motion.div>
        </div>
      </UContainer>
    </section>

    <!-- Steps -->
    <UPageSection
      id="etapes"
      headline="Comment ça marche"
      title="Trois étapes, un jeu unique."
      description="Pas besoin de savoir dessiner : vous choisissez qui joue quel rôle, l’atelier s’occupe des illustrations."
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <motion.div
          v-for="(step, index) in steps"
          :key="step.title"
          v-bind="reveal(index * 0.06)"
        >
          <UPageCard
            :icon="step.icon"
            :title="step.title"
            :description="step.description"
            variant="subtle"
            class="h-full"
          >
            <template #header>
              <span class="font-display text-5xl text-primary/70">0{{ index + 1 }}</span>
            </template>
          </UPageCard>
        </motion.div>
      </div>
    </UPageSection>

    <!-- Table -->
    <UPageSection
      id="table"
      headline="La table"
      title="Une vraie partie, même à distance."
      description="Un salon en 3D, vos cartes en main, et les bots pour compléter la table."
      orientation="horizontal"
      :features="tableFeatures"
      :links="[{ label: 'Ouvrir une table', to: '/play', trailingIcon: 'i-lucide-arrow-right' }]"
    >
      <motion.div
        v-bind="reveal()"
        class="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl bg-neutral-950 ring-1 ring-default"
        aria-hidden="true"
      >
        <div class="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_55%,var(--color-violet-900),transparent_80%)]" />
        <div class="absolute inset-[18%_12%] rounded-[50%] bg-emerald-900 shadow-[inset_0_0_60px_rgba(0,0,0,0.6)] ring-8 ring-amber-950/80" />
        <div
          v-for="(seat, index) in tableSeats"
          :key="seat"
          class="absolute -translate-x-1/2 -translate-y-1/2"
          :style="{
            left: `${50 + 44 * Math.cos(Math.PI / 2 + (index * 2 * Math.PI) / tableSeats.length)}%`,
            top: `${50 + 40 * Math.sin(Math.PI / 2 + (index * 2 * Math.PI) / tableSeats.length)}%`
          }"
        >
          <img
            :src="img(`/salon-cast/${seat}.png`, { width: 120, height: 120, fit: 'cover', format: 'webp' })"
            alt=""
            class="size-12 rounded-full object-cover object-top ring-2 ring-white/20 sm:size-14"
          >
        </div>
        <div class="absolute inset-0 flex items-center justify-center gap-1.5">
          <div
            v-for="(card, index) in fan.slice(1, 4)"
            :key="card.name"
            class="w-12 sm:w-14"
            :style="{ transform: `rotate(${(index - 1) * 12}deg) translateY(${index === 1 ? -6 : 0}px)` }"
          >
            <CardArt
              :image="card.image"
              :index="card.index"
              :red="card.red"
              :theme="card.theme"
              class="shadow-lg shadow-black/50"
            />
          </div>
        </div>
      </motion.div>
    </UPageSection>

    <!-- Print -->
    <UPageSection
      id="impression"
      headline="Impression"
      title="Prêt à partir chez l’imprimeur."
      description="Le même jeu sert à jouer en ligne et à imprimer un vrai paquet de cartes."
      orientation="horizontal"
      reverse
      :features="printFeatures"
    >
      <motion.div
        v-bind="reveal()"
        class="relative mx-auto flex w-full max-w-md items-center justify-center gap-6 py-6"
        aria-hidden="true"
      >
        <div class="w-40 -rotate-6 sm:w-48">
          <CardArt
            :image="fan[1]!.image"
            :index="fan[1]!.index"
            red
            :theme="fan[1]!.theme"
            class="shadow-xl outline-2 outline-offset-[10px] outline-dashed outline-primary/40"
          />
        </div>
        <div class="w-40 rotate-6 sm:w-48">
          <CardArt
            :theme="fan[1]!.theme"
            glyph="✦"
            class="shadow-xl"
          />
        </div>
      </motion.div>
    </UPageSection>

    <UPageSection>
      <UPageCTA
        title="Ouvrez une table ce soir."
        description="Créez un compte, ajoutez quelques photos et testez une première carte avant de lancer tout le jeu."
        variant="subtle"
        :links="[
          { label: 'Créer mon jeu', to: startLink, size: 'lg', trailingIcon: 'i-lucide-arrow-right' },
          { label: 'Jouer avec un deck existant', to: '/play', size: 'lg', color: 'neutral', variant: 'ghost' }
        ]"
        :ui="{ title: 'font-display text-4xl sm:text-5xl' }"
      />
    </UPageSection>
  </div>
</template>
