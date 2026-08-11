import { toPublicView } from '~~/shared/tarot'
import { gameStore } from '~~/server/game/GameStore'

export default defineEventHandler((event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ status: 400, message: 'Code de partie manquant' })
  }

  const state = gameStore.get(code)
  if (!state) {
    throw createError({ status: 404, message: 'Partie introuvable' })
  }

  return toPublicView(state)
})
