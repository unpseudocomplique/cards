import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSculptedGuest } from '~/utils/salonSculpt/buildSculptedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** Authored seated sculpt (no photo projection). */
export function createAurelienModel(options: SalonModelOptions = {}) {
  return buildSculptedGuest(salonSculptSpec('aurelien'), options)
}
