export type DeckTextureManifest = {
  deckId: string
  backUrl: string | null
  cards: Array<{
    cardCode: string
    faceUrl: string | null
    aspectRatio: '3:4' | '9:16'
  }>
}
