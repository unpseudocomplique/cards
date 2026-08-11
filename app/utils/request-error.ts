type RequestErrorLike = {
  data?: {
    data?: {
      code?: string
      message?: string
    }
    message?: string
    statusMessage?: string
  }
  message?: string
  response?: {
    _data?: {
      data?: {
        code?: string
        message?: string
      }
      message?: string
      statusMessage?: string
    }
  }
  statusMessage?: string
  statusText?: string
}

const GENERIC_HTTP_MESSAGES = new Set([
  'server error',
  'internal server error',
  'bad request',
  'request error',
  'not found',
  'unauthorized',
  'forbidden',
  'conflict',
  'unprocessable entity',
  'too many requests',
  'service unavailable',
  'gateway timeout'
])

function extractReadableMessage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const trimmed = value.trim()

  if (/^\[[A-Z]+]\s+".*":\s*\d{3}\b/.test(trimmed)) {
    return null
  }

  if (GENERIC_HTTP_MESSAGES.has(trimmed.toLowerCase())) {
    return null
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Array<{ message?: string }>
      const firstMessage = parsed.find(issue => typeof issue?.message === 'string' && issue.message.trim())?.message
      if (firstMessage) {
        return extractReadableMessage(firstMessage)
      }
    } catch {
      return null
    }
    return null
  }

  return trimmed
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const requestError = error as RequestErrorLike
  const candidates = [
    requestError.data?.data?.message,
    requestError.data?.message,
    requestError.response?._data?.data?.message,
    requestError.response?._data?.message,
    requestError.data?.statusMessage,
    requestError.response?._data?.statusMessage,
    requestError.statusMessage,
    requestError.statusText,
    requestError.message
  ]

  for (const candidate of candidates) {
    const message = extractReadableMessage(candidate)
    if (message) {
      return message
    }
  }

  return fallback
}
