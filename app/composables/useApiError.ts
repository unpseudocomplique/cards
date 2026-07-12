import type { DeckCard } from '~/types/deck'

type ApiErrorBody = {
  message?: string
  statusMessage?: string
  data?: {
    message?: string
    code?: string
    card?: DeckCard
    cardId?: string
  }
}

type FetchLikeError = {
  data?: ApiErrorBody
  statusCode?: number
  statusMessage?: string
  message?: string
}

function isFetchLikeError(error: unknown): error is FetchLikeError {
  return Boolean(error && typeof error === 'object')
}

export function getApiErrorMessage(error: unknown, fallback = 'Veuillez réessayer.') {
  if (!isFetchLikeError(error)) {
    return fallback
  }

  if (error.data?.message) {
    return error.data.message
  }

  if (error.data?.data?.message) {
    return error.data.data.message
  }

  if (error.statusMessage && !error.statusMessage.startsWith('Server Error')) {
    return error.statusMessage
  }

  if (error.message && !error.message.startsWith('[POST]') && !error.message.startsWith('[GET]')) {
    return error.message
  }

  return fallback
}

export function getApiErrorCard(error: unknown) {
  if (!isFetchLikeError(error)) {
    return null
  }

  return error.data?.data?.card || null
}

export function getApiErrorCode(error: unknown) {
  if (!isFetchLikeError(error)) {
    return null
  }

  return error.data?.data?.code || null
}
