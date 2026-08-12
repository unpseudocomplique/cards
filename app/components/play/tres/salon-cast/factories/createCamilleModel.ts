import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Camille (updo, gold scarf, velvet jacket). */
export async function createCamilleModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('camille'), options)
}
