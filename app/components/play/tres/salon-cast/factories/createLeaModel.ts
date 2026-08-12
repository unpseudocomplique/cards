import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSculptedGuest } from '~/utils/salonSculpt/buildSculptedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

export function createLeaModel(options: SalonModelOptions = {}) {
  return buildSculptedGuest(salonSculptSpec('lea'), options)
}
