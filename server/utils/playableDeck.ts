export type PlayableDeckCheck = {
  type: string
}

/** Pure guard used by create-table API (and unit tests). */
export function assertPlayableTarotDeck(deck: PlayableDeckCheck): void {
  if (deck.type !== 'tarot78') {
    throw createError({
      status: 400,
      message: 'Le deck doit être de type tarot78',
    })
  }
}
