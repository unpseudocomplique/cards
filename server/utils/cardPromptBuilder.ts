import type { DeckStyleSettings } from '~~/server/database/schema'

type PromptCard = {
  label: string
  promptHint: string
  rank?: string
  role?: string
  shortLabel?: string
  suit?: string
}

const roleDirection: Record<string, string> = {
  ace: 'Composition centrale simple, présence noble et silhouette claire.',
  jack: 'Le personnage doit vraiment évoquer un valet de cour: jeune officier, page ou messager élégant, posture active, un seul accessoire maximum.',
  knight: 'Le personnage doit évoquer un cavalier de tarot: tenue de chevalerie ou de voyage, allure héroïque, monture seulement suggérée si elle ne surcharge pas la carte.',
  queen: 'Le personnage doit vraiment évoquer une dame royale: port noble, couronne ou bijou discret, vêtements raffinés mais lisibles.',
  king: 'Le personnage doit vraiment évoquer un roi: posture souveraine, couronne ou manteau royal visible, détails limités.',
  trump: 'Composition de tarot sobre et verticale: un thème principal lisible, peu d accessoires, scène non encombrée.',
  excuse: 'Personnage libre et poétique de tarot, voyageur ou fou bienveillant, composition simple et lisible.',
  number: 'Portrait décoratif très sobre: personnage clair, peu d accessoires, arrière-plan simple.'
}

const suitTheme: Record<string, string> = {
  hearts: 'Thème de couleur Coeurs: costume avec accents rouges, bordeaux ou rose profond, chaleur et élégance; aucun pictogramme de coeur, aucune forme de coeur.',
  diamonds: 'Thème de couleur Carreaux: costume avec accents rouges, dorés ou géométriques raffinés; aucun pictogramme de carreau, aucun losange isolé de carte.',
  clubs: 'Thème de couleur Trèfles: costume avec accents vert sombre, noir ou broderies végétales discrètes; aucun pictogramme de trèfle, aucune feuille en forme de symbole de carte.',
  spades: 'Thème de couleur Piques: costume avec accents noirs, bleu nuit ou argentés, allure noble et stricte; aucun pictogramme de pique, aucune forme de pique.',
  trumps: 'Thème Atout: ambiance de tarot sobre, verticale et théâtrale, sans chiffres ni cartouches imprimés dans l image.'
}

export function buildCardImagePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  return [
    `Transforme la personne de la photo de référence en illustration pour une carte ${card.label}.`,
    `Style visuel: ${settings.visualStyle}.`,
    card.promptHint,
    card.role ? roleDirection[card.role] : null,
    card.suit ? suitTheme[card.suit] : null,
    'La composition doit rester sobre: un personnage principal, arrière-plan simple, peu d accessoires, aucune surcharge décorative.',
    'Laisse volontairement les quatre coins et le bas de la carte dégagés pour les indices imprimés ajoutés ensuite.',
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null,
    'Conserve une ressemblance claire avec la personne, en gardant une expression naturelle et flatteuse.',
    'Ne génère aucun texte, aucun chiffre, aucune lettre, aucun index de carte, aucun pictogramme de coeur, carreau, trèfle ou pique dans l image.',
    'Les seuls éléments qui identifieront la carte seront ajoutés après génération par le renderer; ne les dessine pas dans l illustration.',
    'Image finale nette, cohérente avec un jeu de cartes premium, mais lisible au premier regard.'
  ].filter(Boolean).join(' ')
}
