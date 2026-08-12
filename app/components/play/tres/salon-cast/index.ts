import type { Group } from 'three'
import type { SalonModelOptions } from '~/utils/salonSculpt/types'
import { createAurelienModel } from './factories/createAurelienModel'
import { createCamilleModel } from './factories/createCamilleModel'
import { createHassanModel } from './factories/createHassanModel'
import { createInesModel } from './factories/createInesModel'
import { createJulienModel } from './factories/createJulienModel'
import { createLeaModel } from './factories/createLeaModel'
import { createMarcoModel } from './factories/createMarcoModel'
import { createNadegeModel } from './factories/createNadegeModel'
import { createOlivierModel } from './factories/createOlivierModel'
import { createSofiaModel } from './factories/createSofiaModel'

export type SalonCastId =
  | 'aurelien'
  | 'camille'
  | 'hassan'
  | 'ines'
  | 'julien'
  | 'lea'
  | 'marco'
  | 'nadege'
  | 'olivier'
  | 'sofia'

type Factory = (options?: SalonModelOptions) => Promise<Group>

/** All 10 cast factories (img2threejs-style seated guests). */
export const SALON_CAST_FACTORIES: Record<SalonCastId, Factory> = {
  aurelien: createAurelienModel,
  camille: createCamilleModel,
  hassan: createHassanModel,
  ines: createInesModel,
  julien: createJulienModel,
  lea: createLeaModel,
  marco: createMarcoModel,
  nadege: createNadegeModel,
  olivier: createOlivierModel,
  sofia: createSofiaModel,
}

export async function createSalonCastModel(
  id: string,
  options: SalonModelOptions = {},
): Promise<Group> {
  const factory = SALON_CAST_FACTORIES[id as SalonCastId]
  if (!factory) {
    throw new Error(`No salon cast factory for id: ${id}`)
  }
  return factory(options)
}

export {
  createAurelienModel,
  createCamilleModel,
  createHassanModel,
  createInesModel,
  createJulienModel,
  createLeaModel,
  createMarcoModel,
  createNadegeModel,
  createOlivierModel,
  createSofiaModel,
}
