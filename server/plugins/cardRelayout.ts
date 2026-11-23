import { relayoutAllStaleFaces } from '../utils/cardRelayout'

/**
 * After a layout change (e.g. bigger index corners), redraw the stored faces
 * in the background, from the images kept at generation (no AI call).
 */
export default defineNitroPlugin(() => {
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    return
  }
  setTimeout(() => {
    void relayoutAllStaleFaces()
  }, 15_000)
})
