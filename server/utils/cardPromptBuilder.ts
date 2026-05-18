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
  ace: 'Composition symbolique simple, un emblème fort, silhouette claire.',
  jack: 'Le personnage doit vraiment évoquer un valet de cour: jeune officier, page ou messager élégant, posture active, un seul accessoire maximum.',
  knight: 'Le personnage doit évoquer un cavalier de tarot: tenue de chevalerie ou de voyage, allure héroïque, monture seulement suggérée si elle ne surcharge pas la carte.',
  queen: 'Le personnage doit vraiment évoquer une dame royale: port noble, couronne ou bijou discret, vêtements raffinés mais lisibles.',
  king: 'Le personnage doit vraiment évoquer un roi: posture souveraine, couronne ou manteau royal visible, détails limités.',
  trump: 'Composition de tarot sobre et verticale: un symbole principal lisible, peu d accessoires, scène non encombrée.',
  excuse: 'Personnage libre et poétique de tarot, voyageur ou fou bienveillant, composition simple et lisible.',
  number: 'Carte numérale décorative très sobre: portrait clair, peu d accessoires, arrière-plan simple.'
}

export function buildCardImagePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  return [
    `Transforme la personne de la photo de référence en illustration pour ${card.label}.`,
    `Style visuel: ${settings.visualStyle}.`,
    card.promptHint,
    card.role ? roleDirection[card.role] : null,
    'La composition doit rester sobre: un personnage principal, arrière-plan simple, peu d accessoires, aucune surcharge décorative.',
    'Laisse volontairement les quatre coins et le bas de la carte dégagés pour les indices imprimés ajoutés ensuite.',
    cardPrompt ? `Instructions spécifiques pour cette carte: ${cardPrompt}.` : null,
    'Conserve une ressemblance claire avec la personne, en gardant une expression naturelle et flatteuse.',
    'Ne génère aucun texte, aucun chiffre, aucune lettre et aucun symbole de carte dans l image.',
    'Image finale nette, cohérente avec un jeu de cartes premium, mais lisible au premier regard.'
  ].filter(Boolean).join(' ')
}
