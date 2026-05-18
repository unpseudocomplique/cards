type SessionUserSource = {
  id: string
  email: string
  username: string
  picture: string | null
  role: 'USER' | 'ADMIN'
  locale: string
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const sanitizeInternalRedirect = (value?: string | null) => {
  const redirect = String(value || '').trim()

  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/dashboard'
  }

  return redirect
}

export const buildSessionUser = (user: SessionUserSource) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  picture: user.picture,
  role: user.role,
  locale: user.locale
})
