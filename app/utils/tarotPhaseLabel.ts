import type { Phase } from '~~/shared/tarot'

const PHASE_LABELS: Record<Phase, string> = {
  Lobby: 'Salle d\'attente',
  Dealing: 'Distribution',
  Bidding: 'Enchères',
  DogEcarta: 'Chien et écart',
  ReadyToPlay: 'Prêt à jouer',
  Trick: 'Pli en cours',
  Scoring: 'Marquage',
  MatchOver: 'Partie terminée',
}

export function tarotPhaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase]
}
