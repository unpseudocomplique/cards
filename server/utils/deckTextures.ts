import { buildTarot78Deck } from '~~/shared/tarot'
import type { CardFormatId } from '~~/shared/utils/printSpec'
import { cardFormatRatio, getCardFormat } from '~~/shared/utils/printSpec'
import type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

export type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

/**
 * Every card of a deck shares one format (and one back). Faces or a back left
 * over from a previous format are dropped, so the table never mixes sizes:
 * those cards fall back to the classic placeholder until regenerated.
 */
export function buildDeckTextureManifest(input: {
  deckId: string
  format?: CardFormatId | null
  backUrl: string | null
  backFormat?: CardFormatId | null
  cards: Array<{ cardCode: string, finalImageUrl: string | null, format?: CardFormatId | null }>
}): DeckTextureManifest {
  const format = getCardFormat(input.format)
  const aspectRatio = format.id === 'tarot' ? '9:16' : '3:4'
  const byCode = new Map(input.cards.map(card => [card.cardCode, card]))
  const cards = buildTarot78Deck().map((cardCode) => {
    const row = byCode.get(cardCode)
    const usable = row?.finalImageUrl && getCardFormat(row.format).id === format.id

    return {
      cardCode,
      faceUrl: usable ? row!.finalImageUrl : null,
      aspectRatio
    } as const
  })

  return {
    deckId: input.deckId,
    format: format.id,
    cardRatio: cardFormatRatio(format),
    backUrl: input.backUrl && getCardFormat(input.backFormat).id === format.id ? input.backUrl : null,
    cards
  }
}
