export type GenerationErrorCode =
  | 'NO_IMAGE'
  | 'API_UNAVAILABLE'
  | 'API_RATE_LIMIT'
  | 'API_AUTH'
  | 'PHOTO_UNAVAILABLE'
  | 'RENDER_FAILED'
  | 'STORAGE_FAILED'
  | 'UNKNOWN'

type NormalizedGenerationError = {
  code: GenerationErrorCode
  message: string
  status: number
  cause?: string
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Génération impossible'
}

function includesAny(text: string, needles: string[]) {
  return needles.some(needle => text.includes(needle))
}

export function normalizeGenerationError(error: unknown): NormalizedGenerationError {
  const rawMessage = getErrorText(error)
  const lower = rawMessage.toLowerCase()

  if (includesAny(lower, ['assemblage de la carte', 'render', 'sharp', 'index font not found', 'police d\'affichage'])) {
    return {
      code: 'RENDER_FAILED',
      message: 'Police d\'affichage introuvable sur le serveur. Contactez l\'administrateur.',
      status: 500,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['photo source inaccessible', 'photo inaccessible', 'failed to fetch photo'])) {
    return {
      code: 'PHOTO_UNAVAILABLE',
      message: 'Impossible de lire une photo de référence. Réimportez-la puis réessayez.',
      status: 422,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['aucune image', 'no image generated', 'no image'])) {
    return {
      code: 'NO_IMAGE',
      message: 'Le modèle n\'a pas renvoyé d\'image. Réessayez dans quelques instants.',
      status: 422,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['s3 configuration', 'storage', 'putobject', 'upload'])) {
    return {
      code: 'STORAGE_FAILED',
      message: 'Stockage des images indisponible. Réessayez plus tard.',
      status: 503,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['api key', 'api_key', 'unauthorized', 'permission denied', 'invalid authentication'])) {
    return {
      code: 'API_AUTH',
      message: 'Clé API Google invalide ou manquante.',
      status: 503,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['quota', 'rate limit', 'resource_exhausted', 'too many requests', '429'])) {
    return {
      code: 'API_RATE_LIMIT',
      message: 'Limite de requêtes atteinte. Patientez puis relancez.',
      status: 429,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['fetch failed', 'network', 'econnreset', 'etimedout', 'socket hang up', 'service unavailable'])) {
    return {
      code: 'API_UNAVAILABLE',
      message: 'Service d\'IA temporairement indisponible. Réessayez.',
      status: 503,
      cause: rawMessage
    }
  }

  if (includesAny(lower, ['input validation', 'invalid argument', 'bad request'])) {
    return {
      code: 'API_UNAVAILABLE',
      message: 'Requête refusée par le service d\'IA. Réessayez ou changez la carte testée.',
      status: 422,
      cause: rawMessage
    }
  }

  return {
    code: 'UNKNOWN',
    message: rawMessage || 'Génération impossible.',
    status: 422,
    cause: rawMessage
  }
}
