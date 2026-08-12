import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { buildSalonSeatedGuest } from '~/utils/salonSculpt/buildSeatedGuest'
import { salonSculptSpec } from '~/utils/salonSculpt/specs'

/** img2threejs-style factory — Inès (bob, gold bow, tuxedo shirt). */
export async function createInesModel(options: SalonModelOptions = {}) {
  return buildSalonSeatedGuest(salonSculptSpec('ines'), options)
}
