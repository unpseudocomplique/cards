import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Nadège (silver bun, scarf, evening dress). */
export async function createNadegeModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('nadege'), options)
}
