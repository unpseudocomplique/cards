import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Julien (slicked hair, pin, tuxedo). */
export async function createJulienModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('julien'), options)
}
