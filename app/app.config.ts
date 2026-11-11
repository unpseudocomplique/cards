export default defineAppConfig({
  app: {
    name: 'Cartes personnalisées',
    shortName: 'Cartes',
    tagline: 'Le tarot à vos visages'
  },
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc'
    },
    button: {
      slots: {
        base: 'transition-[transform,background-color,color,box-shadow] active:translate-y-px'
      }
    },
    card: {
      slots: {
        root: 'rounded-xl'
      }
    },
    dashboardPanel: {
      slots: {
        body: 'sm:p-6 lg:p-8'
      }
    },
    dashboardNavbar: {
      slots: {
        title: 'font-semibold'
      }
    },
    pageHero: {
      slots: {
        title: 'font-display text-5xl sm:text-6xl lg:text-7xl text-balance',
        description: 'text-pretty'
      }
    },
    pageSection: {
      slots: {
        title: 'font-display text-4xl sm:text-5xl text-balance'
      }
    }
  }
})
