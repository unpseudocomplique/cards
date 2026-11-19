/**
 * Saving a shared deck: the visitor gets a deck of their own with the faces
 * already generated, card for card, and nothing else (no photos, persons or
 * prompts). Copying never calls the image model.
 */

type CopyFaceSource = {
  status: string
  finalImageUrl: string | null
  metadata: { format?: string | null, design?: 'classic', theme?: string | null }
}

export type CopySourceCard = CopyFaceSource & {
  id: string
  cardCode: string
}

export type CopyOverride = {
  baseCardId: string
  status: string
  finalImageUrl: string | null
  metadata: { format?: string | null }
}

export type CopiedFace = {
  finalImageUrl: string
  format?: string
  design?: 'classic'
  theme?: string
}

/**
 * Face of each card of the copy, by card code, for one version of the deck
 * (the deck itself, or one variant's overrides). A card the variant changes
 * but has not generated yet is left empty, never shown with the deck face.
 */
export function resolveCopiedFaces(sourceCards: CopySourceCard[], overrides: CopyOverride[] = []) {
  const overrideByCard = new Map(overrides.map(override => [override.baseCardId, override]))
  const faces = new Map<string, CopiedFace>()

  for (const card of sourceCards) {
    const override = overrideByCard.get(card.id)

    if (override) {
      if (override.status === 'ready' && override.finalImageUrl) {
        faces.set(card.cardCode, {
          finalImageUrl: override.finalImageUrl,
          ...(override.metadata.format ? { format: override.metadata.format } : {})
        })
      }
      continue
    }

    if (card.status === 'ready' && card.finalImageUrl) {
      faces.set(card.cardCode, {
        finalImageUrl: card.finalImageUrl,
        ...(card.metadata.format ? { format: card.metadata.format } : {}),
        ...(card.metadata.design ? { design: card.metadata.design } : {}),
        ...(card.metadata.theme ? { theme: card.metadata.theme } : {})
      })
    }
  }

  return faces
}
