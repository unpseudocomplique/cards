import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Marco (thick dark hair, burgundy bow, tuxedo). */
export async function createMarcoModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('marco'), options)
}
