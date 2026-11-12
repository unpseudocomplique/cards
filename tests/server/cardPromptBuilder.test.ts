import { describe, expect, it } from 'vitest'
import type { DeckStyleSettings } from '../../server/database/schema'
import { buildCardForegroundPrompt, buildCardScenePrompt, getCardPromptLayers } from '../../server/utils/cardPromptBuilder'

const settings: DeckStyleSettings = {
  allowPhotoReuse: true,
  visualStyle: 'aquarelle douce, tons pastel',
  colorTheme: 'royal',
  suitPrompts: { hearts: 'Cœurs : ambiance chaleureuse et tendre.' },
  rolePrompts: { king: 'Les Rois portent une couronne fine.' }
}

const kingOfHearts = {
  label: 'Roi de Coeurs',
  shortLabel: 'R♥',
  rank: 'K',
  role: 'king',
  suit: 'hearts',
  promptHint: 'roi majestueux'
}

const person = { label: 'Paul', prompt: 'Ses chiens sont sur une des photos : ne les dessine pas.' }
const cardPrompt = 'Avec ses deux chiens assis à ses pieds.'

describe('prompt layers', () => {
  it('stacks deck, suit, rank, person and card from general to specific', () => {
    const layers = getCardPromptLayers(kingOfHearts, settings, { person, cardPrompt })

    expect(layers.map(layer => layer.level)).toEqual(['deck', 'suit', 'role', 'person', 'card'])
    expect(layers.map(layer => layer.title)).toEqual([
      'Jeu entier',
      'Couleur · Cœurs',
      'Type · Rois',
      'Personne · Paul',
      'Carte · Roi de Coeurs'
    ])
    expect(layers[0]!.text).toBe('aquarelle douce, tons pastel')
    expect(layers[3]!.text).toBe(person.prompt)
    expect(layers[4]!.text).toBe(cardPrompt)
  })

  it('skips empty person and card layers', () => {
    const layers = getCardPromptLayers(kingOfHearts, settings, { person: { label: 'Paul', prompt: '  ' }, cardPrompt: null })
    expect(layers.map(layer => layer.level)).toEqual(['deck', 'suit', 'role'])
  })

  it('tells the model that the later, more specific layer wins', () => {
    const prompt = buildCardForegroundPrompt(kingOfHearts, settings, { person, cardPrompt })

    expect(prompt).toContain('the later, more specific layer wins')
    expect(prompt).toContain(`4. Person (Paul): ${person.prompt}`)
    expect(prompt).toContain(`5. This card (Roi de Coeurs): ${cardPrompt}`)
    expect(prompt.indexOf(person.prompt)).toBeLessThan(prompt.indexOf(cardPrompt))
    expect(prompt.indexOf('aquarelle douce')).toBeLessThan(prompt.indexOf('Cœurs : ambiance'))
    // Companions on reference photos only come in when a layer asks for them.
    expect(prompt).toContain('Include them only when a layer above asks for them on this card')
  })

  it('keeps people and animals out of the background layer', () => {
    const prompt = buildCardScenePrompt(kingOfHearts, settings, { person, cardPrompt })

    expect(prompt).toContain(cardPrompt)
    expect(prompt).toContain('People, pets and animals they mention belong to the separate character layer')
  })
})
