<script setup lang="ts">
import { motion } from 'motion-v'

definePageMeta({
  layout: 'landing'
})

useSeoMeta({
  title: 'Tarot en salon',
  description: 'Jouez au tarot français autour d’une table 3D, avec un jeu à vos visages. Créez un deck, invitez la table, enchassez les plis.'
})

const reducedMotion = usePreferredReducedMotion()
const prefersReduced = computed(() => reducedMotion.value === 'reduce')

const spring = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 24
}

const steps = [
  {
    kicker: '01',
    title: 'Asseyez-vous à la table',
    body: 'Créez une partie privée, invitez jusqu’à cinq joueurs, et laissez le salon 3D poser le tapis, les sièges et le chien.'
  },
  {
    kicker: '02',
    title: 'Vos visages sur le jeu',
    body: 'Importez des photos. Les figures, cavaliers et atouts prennent les traits de votre table — mariage, famille ou bande habituelle.'
  },
  {
    kicker: '03',
    title: 'Jouez, ou imprimez',
    body: 'Enchères, écart, plis et marquage en ligne. Le même deck part aussi en pack 300 DPI, fond perdu et dos de carte.'
  }
]

function enter(delay = 0) {
  if (prefersReduced.value) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 }
    }
  }

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring, delay }
  }
}

const heroMotion = computed(() => ({
  kicker: enter(0),
  title: enter(0.08),
  body: enter(0.16),
  actions: enter(0.24)
}))
</script>

<template>
  <div>
    <section class="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10 min-[720px]:min-h-[calc(100dvh-5.5rem)] min-[720px]:py-4">
      <LandingAmbient />
      <div class="relative mx-auto grid max-w-6xl items-center gap-8 min-[720px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] min-[720px]:gap-6">
        <div class="max-w-xl">
          <motion.p
            class="flex items-center gap-2.5 text-xs tracking-[0.22em] text-primary uppercase"
            v-bind="heroMotion.kicker"
          >
            <span class="salon-live relative size-1.5 shrink-0 rounded-full bg-gold-400" />
            Salon de tarot
          </motion.p>
          <motion.span
            class="mt-3 block h-px w-12 origin-left bg-gold-500/70"
            aria-hidden="true"
            :initial="prefersReduced ? false : { scaleX: 0 }"
            :animate="{ scaleX: 1 }"
            :transition="{ ...spring, delay: prefersReduced ? 0 : 0.1 }"
          />
          <motion.h1
            class="mt-3 font-serif text-4xl leading-[1.05] font-medium tracking-tight text-pretty text-highlighted sm:text-5xl lg:text-6xl max-[500px]:mt-1 max-[500px]:text-3xl"
            v-bind="heroMotion.title"
          >
            La table est dressée. Il ne manque que vos cartes.
          </motion.h1>
          <motion.p
            class="mt-5 max-w-[38ch] text-base leading-relaxed text-pretty text-muted sm:text-lg max-[500px]:mt-2 max-[500px]:text-sm"
            v-bind="heroMotion.body"
          >
            Tarot français à 3, 4 ou 5 joueurs, dans un salon 3D. Jouez avec un deck classique, ou un tarot dont les figures portent vos visages.
          </motion.p>
          <motion.div
            class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center max-[500px]:mt-3"
            v-bind="heroMotion.actions"
          >
            <motion.div
              class="w-full sm:w-auto"
              :while-hover="prefersReduced ? undefined : { scale: 1.03 }"
              :while-tap="prefersReduced ? undefined : { scale: 0.97 }"
              :transition="{ type: 'spring', stiffness: 420, damping: 22 }"
            >
              <UButton
                to="/play"
                size="lg"
                icon="i-lucide-spade"
                class="w-full justify-center sm:w-auto"
              >
                Jouer au tarot
              </UButton>
            </motion.div>
            <motion.div
              class="w-full sm:w-auto"
              :while-hover="prefersReduced ? undefined : { scale: 1.03 }"
              :while-tap="prefersReduced ? undefined : { scale: 0.97 }"
              :transition="{ type: 'spring', stiffness: 420, damping: 22 }"
            >
              <UButton
                to="/decks/new"
                size="lg"
                color="neutral"
                variant="outline"
                icon="i-lucide-layers"
                class="w-full justify-center sm:w-auto"
              >
                Créer un deck
              </UButton>
            </motion.div>
          </motion.div>
        </div>

        <LandingCardFan class="[@media(max-height:500px)]:hidden min-[720px]:justify-self-end" />
      </div>
    </section>

    <section class="border-t border-default/70">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div
          class="max-w-lg"
          :initial="prefersReduced ? false : { opacity: 0, y: 20 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, margin: '-12% 0px' }"
          :transition="spring"
        >
          <p class="text-xs tracking-[0.22em] text-primary uppercase">
            Autour de la table
          </p>
          <h2 class="mt-3 font-serif text-3xl tracking-tight text-highlighted sm:text-4xl">
            Un jeu de salon, pas un tableau de bord.
          </h2>
        </motion.div>

        <ol class="mt-12 space-y-12 sm:mt-16">
          <motion.li
            v-for="(step, index) in steps"
            :key="step.kicker"
            class="grid gap-4 border-t border-default/70 pt-8 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-10"
            :initial="prefersReduced ? false : { opacity: 0, y: 22 }"
            :while-in-view="{ opacity: 1, y: 0 }"
            :in-view-options="{ once: true, margin: '-10% 0px' }"
            :transition="{ ...spring, delay: prefersReduced ? 0 : index * 0.06 }"
          >
            <p class="font-serif text-3xl text-primary/80">
              {{ step.kicker }}
            </p>
            <div class="max-w-xl sm:col-start-2 sm:justify-self-end">
              <h3 class="text-xl font-medium text-highlighted">
                {{ step.title }}
              </h3>
              <p class="mt-2 text-pretty text-muted">
                {{ step.body }}
              </p>
            </div>
          </motion.li>
        </ol>
      </div>
    </section>

    <section class="border-t border-default/70 bg-muted/25">
      <motion.div
        class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-16"
        :initial="prefersReduced ? false : { opacity: 0, y: 18 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, margin: '-12% 0px' }"
        :transition="spring"
      >
        <div class="max-w-lg">
          <h2 class="font-serif text-3xl tracking-tight text-highlighted">
            Ouvrez une table ce soir.
          </h2>
          <p class="mt-3 text-pretty text-muted">
            Sur téléphone, la partie se joue en paysage — comme un vrai tapis devant soi.
          </p>
        </div>
        <motion.div
          class="w-full sm:w-auto"
          :while-hover="prefersReduced ? undefined : { scale: 1.03 }"
          :while-tap="prefersReduced ? undefined : { scale: 0.97 }"
          :transition="{ type: 'spring', stiffness: 420, damping: 22 }"
        >
          <UButton
            to="/play"
            size="lg"
            icon="i-lucide-spade"
            class="w-full justify-center sm:w-auto"
          >
            Lancer une partie
          </UButton>
        </motion.div>
      </motion.div>
    </section>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .salon-live::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: inherit;
    background: inherit;
    animation: salon-live 2.6s ease-out infinite;
  }
}

@keyframes salon-live {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  100% {
    transform: scale(2.8);
    opacity: 0;
  }
}
</style>
