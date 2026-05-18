import type { DeckStyleSettings } from '~~/server/database/schema'
import type { CardDefinition } from './cardCatalog'

type PromptCard = Pick<CardDefinition, 'label' | 'promptHint'>

export function buildCardImagePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  return [
    `Transforme la personne de la photo de référence en illustration pour ${card.label}.`,
    `Style visuel: ${settings.visualStyle}.`,
    card.promptHint,
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null,
    'Conserve une ressemblance claire avec la personne, en gardant une expression naturelle et flatteuse.',
    'Ne génère aucun texte, aucun chiffre, aucune lettre et aucun symbole de carte dans l image.',
    'Laisse de l espace autour du personnage pour une composition finale avec cadre et index imprimables.',
    'Image finale nette, détaillée, cohérente avec un jeu de cartes premium.'
  ].filter(Boolean).join(' ')
}
