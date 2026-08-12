import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Léa (natural short hair, glasses, blazer). */
export async function createLeaModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('lea'), options)
}
