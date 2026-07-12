export type TarotArcanaKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | 'excuse'

export type TarotArcanaDefinition = {
  key: TarotArcanaKey
  number?: number
  name: string
  roman?: string
  /** Short esoteric meaning used to steer illustration. */
  meaning: string
  /** Facial expression / emotional tone the portrait must convey. */
  expression: string
  /** Concrete visual direction for scene + character design. */
  designPrompt: string
}

/**
 * Major arcana of the French / Marseille tarot tradition,
 * used for Atouts 1–21 and the Excuse in tarot78 decks.
 */
export const tarotArcana: Record<TarotArcanaKey, TarotArcanaDefinition> = {
  1: {
    key: '1',
    number: 1,
    name: 'Le Bateleur',
    roman: 'I',
    meaning: 'Commencement, potentiel, habileté, initiative créative.',
    expression: 'regard concentré, léger sourire assuré d initiateur, énergie jeune et alerte — pas de joie enfantine.',
    designPrompt: 'Le Bateleur: figure debout derrière une table d outils ou d objets symboliques, geste d initiation et de maîtrise, début de parcours.'
  },
  2: {
    key: '2',
    number: 2,
    name: 'La Papesse',
    roman: 'II',
    meaning: 'Intuition, savoir intérieur, mystère, silence fertile.',
    expression: 'visage recueilli, regard intérieur calme, bouche neutre, mystère silencieux — jamais un large sourire.',
    designPrompt: 'La Papesse: présence assise ou recueillie, voile ou livre suggéré, lumière feutrée, sagesse intérieure.'
  },
  3: {
    key: '3',
    number: 3,
    name: 'L\'Impératrice',
    roman: 'III',
    meaning: 'Abondance, fertilité, création, nature nourricière.',
    expression: 'douceur souveraine, regard chaleureux et fertile, sérénité créatrice sans naïveté.',
    designPrompt: 'L Impératrice: figure souveraine fertile, motifs végétaux et moisson, couronne ou sceptre discret, abondance naturelle.'
  },
  4: {
    key: '4',
    number: 4,
    name: 'L\'Empereur',
    roman: 'IV',
    meaning: 'Autorité, structure, stabilité, pouvoir affirmé.',
    expression: 'visage ferme, regard droit et stable, mâchoire affirmée, autorité calme — pas de sourire mondain.',
    designPrompt: 'L Empereur: posture assise ou droite, trône ou architecture solide, armure ou manteau structuré.'
  },
  5: {
    key: '5',
    number: 5,
    name: 'Le Pape',
    roman: 'V',
    meaning: 'Transmission, tradition, bénédiction, enseignement.',
    expression: 'bienveillance sacerdotale, regard grave et accueillant, bouche douce sans rictus joyeux.',
    designPrompt: 'Le Pape: figure sacerdotale, geste de bénédiction ou d enseignement, colonne ou autel discret.'
  },
  6: {
    key: '6',
    number: 6,
    name: 'L\'Amoureux',
    roman: 'VI',
    meaning: 'Choix du cœur, union, désir, engagement affectif.',
    expression: 'regard ouvert et sensible, légère tension du choix amoureux, émotion vraie plutôt que sourire publicitaire.',
    designPrompt: 'L Amoureux: tension douce d un choix amoureux, motifs de lien ou de carrefour, chaleur affective sans scène surchargée.'
  },
  7: {
    key: '7',
    number: 7,
    name: 'Le Chariot',
    roman: 'VII',
    meaning: 'Victoire, volonté, progression maîtrisée, élan.',
    expression: 'détermination conquérante, regard vers l avant, confiance victorieuse maîtrisée.',
    designPrompt: 'Le Chariot: allure conquérante en mouvement, char ou monture suggérée, armure légère, direction claire.'
  },
  8: {
    key: '8',
    number: 8,
    name: 'La Justice',
    roman: 'VIII',
    meaning: 'Équilibre, vérité, lucidité, responsabilité.',
    expression: 'regard lucide et impartial, traits nets, bouche fermée, sérénité juste sans chaleur excessive.',
    designPrompt: 'La Justice: posture droite et claire, balance ou lame suggérée sans symbole de carte, composition symétrique.'
  },
  9: {
    key: '9',
    number: 9,
    name: 'L\'Hermite',
    roman: 'IX',
    meaning: 'Solitude choisie, sagesse, quête intérieure, lanterne.',
    expression: 'visage las et sage, regard baissé ou introspectif, solitude volontaire, aucune jovialité.',
    designPrompt: 'L Hermite: marcheur solitaire, lanterne ou lumière guidante, manteau simple, paysage nocturne discret.'
  },
  10: {
    key: '10',
    number: 10,
    name: 'La Roue de Fortune',
    roman: 'X',
    meaning: 'Cycle, destin, changement, retournement du sort.',
    expression: 'expression ambivalente face au destin, tension entre élévation et chute, regard vivant et changeant.',
    designPrompt: 'La Roue de Fortune: motif de cycle ou de roue dans le décor, personnage au centre d un mouvement du destin.'
  },
  11: {
    key: '11',
    number: 11,
    name: 'La Force',
    roman: 'XI',
    meaning: 'Courage doux, maîtrise de soi, puissance apaisée.',
    expression: 'calme confiant, regard doux mais inébranlable, maîtrise intérieure — pas d agressivité ni de sourire large.',
    designPrompt: 'La Force: maîtrise douce plutôt que violence, animal ou force brute apprivoisée en suggestion, geste calme.'
  },
  12: {
    key: '12',
    number: 12,
    name: 'Le Pendu',
    roman: 'XII',
    meaning: 'Sacrifice volontaire, autre regard, pause initiatique.',
    expression: 'abandon serein, regard détaché ou rêveur, acceptation tranquille — pas de panique ni de joie.',
    designPrompt: 'Le Pendu: composition inversée ou suspendue, halo de lumière douce, perspective inhabituelle.'
  },
  13: {
    key: '13',
    number: 13,
    name: 'L\'Arcane sans nom',
    roman: 'XIII',
    meaning: 'Transformation, fin d un cycle, métamorphose nécessaire.',
    expression: 'dignité grave face au changement, regard profond, sérieux du passage — jamais un sourire joyeux.',
    designPrompt: 'L Arcane sans nom: métamorphose plutôt que morbidité, ossature symbolique ou transition sombre vers le renouveau.'
  },
  14: {
    key: '14',
    number: 14,
    name: 'Tempérance',
    roman: 'XIV',
    meaning: 'Harmonie, alchimie, mesure, flux conciliateur.',
    expression: 'paix mesurée, regard apaisé, demi-sourire discret d équilibre, jamais d excès émotionnel.',
    designPrompt: 'Tempérance: geste de verser ou d équilibrer deux éléments, ailes ou fluidité suggérées, palette apaisée.'
  },
  15: {
    key: '15',
    number: 15,
    name: 'Le Diable',
    roman: 'XV',
    meaning: 'Attachement, tentation, pulsion, ombre à affronter.',
    expression: 'sourire sombre et ambigu de tentateur, regard magnétique et trouble, charisme ombragé — jamais un sourire amical, joyeux ou candid.',
    designPrompt: 'Le Diable: figure séductrice et inquiétante, cornes discrètes possibles, chaînes ou liens vers des figures mineures, lumière chaude et trouble, tentation assumée, ombre intérieure, ambiance infernale sobre sans gore.'
  },
  16: {
    key: '16',
    number: 16,
    name: 'La Maison Dieu',
    roman: 'XVI',
    meaning: 'Bouleversement, révélation brutale, effondrement libérateur.',
    expression: 'choc et révélation, visage saisi par la rupture, intensité dramatique — pas de détente ni de sourire.',
    designPrompt: 'La Maison Dieu: tour ou édifice foudroyé, éclair et pierres en chute, rupture soudaine, révélation dramatique.'
  },
  17: {
    key: '17',
    number: 17,
    name: 'L\'Étoile',
    roman: 'XVII',
    meaning: 'Espoir, inspiration, guérison, guidance lumineuse.',
    expression: 'espoir serein, regard inspiré et doux, luminosité intérieure, calme régénérant.',
    designPrompt: 'L Étoile: nuit claire, étoiles ou source d eau, geste d offrande ou de régénération, lumière d espoir.'
  },
  18: {
    key: '18',
    number: 18,
    name: 'La Lune',
    roman: 'XVIII',
    meaning: 'Rêve, illusion, inconscient, chemin incertain.',
    expression: 'regard voilé, rêveur et inquiet, ambiguïté lunaire — pas de clarté joyeuse.',
    designPrompt: 'La Lune: clair de lune, chemin entre deux tours ou deux rives, reflets troubles, rêve et incertitude.'
  },
  19: {
    key: '19',
    number: 19,
    name: 'Le Soleil',
    roman: 'XIX',
    meaning: 'Joie, clarté, réussite rayonnante, vitalité.',
    expression: 'joie claire et rayonnante, sourire ouvert et sincère, vitalité solaire — ici le sourire est juste.',
    designPrompt: 'Le Soleil: lumière dorée abondante, jardin ou mur ensoleillé, vitalité claire et chaleureuse.'
  },
  20: {
    key: '20',
    number: 20,
    name: 'Le Jugement',
    roman: 'XX',
    meaning: 'Éveil, appel, renaissance, verdict intérieur.',
    expression: 'éveil solennel, regard levé ou appelé, gravité d une renaissance — pas de légèreté mondaine.',
    designPrompt: 'Le Jugement: éveil et appel, ange ou trompette suggérée dans le ciel, figures qui se redressent.'
  },
  21: {
    key: '21',
    number: 21,
    name: 'Le Monde',
    roman: 'XXI',
    meaning: 'Accomplissement, plénitude, harmonie du cycle achevé.',
    expression: 'plénitude sereine, regard accompli, joie contenue et harmonieuse, danse intérieure.',
    designPrompt: 'Le Monde: figure centrale dans une couronne ou ellipse, quatre coins du monde suggérés en décor, accomplissement.'
  },
  excuse: {
    key: 'excuse',
    name: 'Le Mat',
    meaning: 'Liberté, innocence audacieuse, départ vers l inconnu.',
    expression: 'innocence audacieuse, regard curieux vers l inconnu, légèreté poétique du voyageur.',
    designPrompt: 'Le Mat / Excuse: voyageur libre au bord du chemin, sac et bâton, chien ou compagnon possible, pas vers l inconnu.'
  }
}

export function getTarotArcana(role?: string | null, rank?: string | null): TarotArcanaDefinition | null {
  if (role === 'excuse') {
    return tarotArcana.excuse
  }

  if (role !== 'trump' || !rank) {
    return null
  }

  return tarotArcana[rank as TarotArcanaKey] || null
}

export function getTarotArcanaLabel(arcana: TarotArcanaDefinition) {
  if (arcana.key === 'excuse') {
    return `Excuse · ${arcana.name}`
  }

  return `Atout ${arcana.number} · ${arcana.roman} ${arcana.name}`
}

export function getTarotArcanaPromptHint(arcana: TarotArcanaDefinition) {
  return `${arcana.designPrompt} Signification: ${arcana.meaning} Expression: ${arcana.expression}`
}
