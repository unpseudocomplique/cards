import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Hassan (beard, lapel pin, dinner jacket). */
export async function createHassanModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('hassan'), options)
}
