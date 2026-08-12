import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Aurélien (salt-pepper, glasses, tuxedo). */
export async function createAurelienModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('aurelien'), options)
}
