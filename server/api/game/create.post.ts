import { z } from 'zod'
import { gameStore } from '~~/server/game/GameStore'

const createGameSchema = z.object({
  playerCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  endMode: z.enum(['threshold', 'deals']).default('threshold'),
  endValue: z.number().int().positive().default(1000),
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as {
    user: { id: string, username?: string, name?: string }
  }
  const body = await readBody(event)
  const result = createGameSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Données invalides',
      data: result.error.flatten(),
    })
  }

  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const hostName = session.user.username ?? session.user.name ?? 'Host'

  const { code } = gameStore.createTable({
    hostUserId: session.user.id,
    hostName,
    playerCount: result.data.playerCount,
    endMode: result.data.endMode,
    endValue: result.data.endValue,
  })

  return {
    code,
    inviteUrl: `${siteUrl}/play/${code}`,
  }
})
