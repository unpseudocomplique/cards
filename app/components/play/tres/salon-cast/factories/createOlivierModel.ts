import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Olivier (white hair, round glasses, tuxedo). */
export async function createOlivierModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('olivier'), options)
}
