import type { DeckStyleSettings } from '~~/server/database/schema'
import type { CardPromptRole, CardPromptSuit } from '~~/shared/utils/cardPromptPresets'
import { cardPromptRoleValues, cardPromptSuitValues, mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'

type PromptCard = {
  label: string
  promptHint: string
  rank?: string
  role?: string
  shortLabel?: string
  suit?: string
}

function isPromptRole(role?: string): role is CardPromptRole {
  return cardPromptRoleValues.includes(role as CardPromptRole)
}

function isPromptSuit(suit?: string): suit is CardPromptSuit {
  return cardPromptSuitValues.includes(suit as CardPromptSuit)
}

export function buildCardImagePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const rolePrompts = mergeRolePrompts(settings.rolePrompts)
  const suitPrompts = mergeSuitPrompts(settings.suitPrompts)
  const role = isPromptRole(card.role) ? card.role : null
  const suit = isPromptSuit(card.suit) ? card.suit : null
  const styleParts = [
    `Style global uniforme du deck: ${settings.visualStyle}.`,
    card.promptHint,
    role ? `Style uniforme du carré ${role}: ${rolePrompts[role]}.` : null,
    suit ? `Style uniforme de la couleur ${suit}: ${suitPrompts[suit]}.` : null,
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null
  ].filter(Boolean).join(' ')

  return [
    `Transforme la personne de la photo de référence en illustration pleine page pour une carte ${card.label}.`,
    styleParts,
    'Génère une illustration complète sans passe-partout blanc, sans fenêtre de carte, sans contour de carte et sans marge artificielle: le renderer placera ensuite l image dans une fenêtre uniforme.',
    'Le personnage doit être centré, lisible en buste ou trois-quarts, au premier plan, avec le décor derrière lui sur toute l image.',
    'Le décor peut varier selon la carte, mais il doit remplir naturellement l arrière-plan de l illustration et rester plus doux que le personnage.',
    'La composition doit rester sobre: un personnage principal, décor simple, peu d accessoires, aucune surcharge décorative.',
    'N ajoute jamais de bordure de carte, jamais de cartouche, jamais d index et jamais de numéro de carte dans l illustration: le blanc autour du visuel et les indices seront ajoutés ensuite par le renderer final.',
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null,
    'Conserve une ressemblance claire avec la personne, en gardant une expression naturelle et flatteuse.',
    'Ne génère aucun texte, aucun chiffre, aucune lettre, aucun index de carte, aucun pictogramme de coeur, carreau, trèfle ou pique dans l image.',
    'Les seuls éléments qui identifieront la carte seront ajoutés après génération par le renderer; ne les dessine pas dans l illustration.',
    'Image finale nette, cohérente avec un jeu de cartes premium, mais lisible au premier regard.'
  ].filter(Boolean).join(' ')
}

export function buildCardScenePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const rolePrompts = mergeRolePrompts(settings.rolePrompts)
  const suitPrompts = mergeSuitPrompts(settings.suitPrompts)
  const role = isPromptRole(card.role) ? card.role : null
  const suit = isPromptSuit(card.suit) ? card.suit : null

  return [
    `Crée uniquement le décor illustré pour une carte ${card.label}, sans personnage principal et sans animal au premier plan.`,
    `Style global uniforme du deck: ${settings.visualStyle}.`,
    role ? `Ambiance du carré ${role}: ${rolePrompts[role]}.` : null,
    suit ? `Ambiance de couleur ${suit}: ${suitPrompts[suit]}.` : null,
    cardPrompt ? `Influence spécifique de la carte: ${cardPrompt}.` : null,
    'Le décor peut varier selon la carte, mais il doit remplir toute l image, rester doux, lisible et cohérent avec une illustration premium.',
    'Aucun texte, aucun chiffre, aucune lettre, aucun symbole de carte, aucun cadre et aucun liseré.',
    'Image de décor pleine page, sans marge blanche, prête à être recadrée dans une fenêtre fixe.'
  ].filter(Boolean).join(' ')
}

export function buildCardForegroundPrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const rolePrompts = mergeRolePrompts(settings.rolePrompts)
  const suitPrompts = mergeSuitPrompts(settings.suitPrompts)
  const role = isPromptRole(card.role) ? card.role : null
  const suit = isPromptSuit(card.suit) ? card.suit : null

  return [
    `Transforme la personne et les compagnons visibles de la photo de référence en personnage illustré pour une carte ${card.label}.`,
    `Style global uniforme du deck: ${settings.visualStyle}.`,
    card.promptHint,
    role ? `Style uniforme du carré ${role}: ${rolePrompts[role]}.` : null,
    suit ? `Style uniforme de la couleur ${suit}: ${suitPrompts[suit]}.` : null,
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null,
    'Le personnage doit être entier ou en trois-quarts, au premier plan, avec une silhouette lisible qui pourra dépasser de la fenêtre de décor.',
    'Fond obligatoire: vert chroma key pur, uniforme, plat, couleur #00ff00, sans texture, sans décor, sans ombre portée verte.',
    'La silhouette doit rester propre, sans reflet vert, sans halo vert et sans contamination verte sur les cheveux, la peau ou les vêtements.',
    'Ne mets aucun décor derrière le personnage, uniquement le fond vert pur pour permettre un détourage automatique.',
    'Aucun texte, aucun chiffre, aucune lettre, aucun symbole de carte, aucun cadre et aucun liseré.',
    'Conserve une ressemblance claire avec la personne, expression naturelle et flatteuse, rendu net et premium.'
  ].filter(Boolean).join(' ')
}
