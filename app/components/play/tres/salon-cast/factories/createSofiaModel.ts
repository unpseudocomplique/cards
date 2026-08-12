import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Sofia (long waves, gold pin, satin jacket). */
export async function createSofiaModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('sofia'), options)
}
