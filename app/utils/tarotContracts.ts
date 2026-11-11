import type { Contract } from '~~/shared/tarot'

export const contractLabels: Record<Contract, string> = {
  prise: 'Prise',
  garde: 'Garde',
  garde_sans: 'Garde sans',
  garde_contre: 'Garde contre'
}

export const contractRank: Record<Contract, number> = {
  prise: 1,
  garde: 2,
  garde_sans: 3,
  garde_contre: 4
}

export const contracts = Object.keys(contractRank) as Contract[]
