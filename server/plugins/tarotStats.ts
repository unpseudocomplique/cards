import { gameStore } from '../game/GameStore'
import { handleGameEvents } from '../utils/tarotStatsRecorder'

/** Save every scored deal and finished match for the statistics page. */
export default defineNitroPlugin(() => {
  if (!process.env.DATABASE_URL) {
    console.warn('[stats] DATABASE_URL is not set: tarot statistics will not be saved.')
    return
  }
  gameStore.setOnGameEvents(handleGameEvents)
})
