export default defineAppConfig({
  global: {
    name: 'Cartes personnalisées',
    email: 'bonjour@cartes.app'
  },
  ui: {
    colors: {
      primary: 'gold',
      neutral: 'ink'
    },
    button: {
      slots: {
        base: 'active:scale-[0.96] transition-transform'
      }
    },
    pageHero: {
      slots: {
        container: 'py-16 sm:py-24 lg:py-28',
        title: 'font-serif font-medium tracking-tight text-pretty text-4xl sm:text-5xl lg:text-6xl',
        description: 'mt-4 max-w-[42rem] text-pretty text-base sm:text-lg text-muted'
      }
    }
  },
  footer: {
    credits: `Cartes personnalisées · ${new Date().getFullYear()}`,
    colorMode: true
  }
})
