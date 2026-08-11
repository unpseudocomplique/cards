import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PASSWORD_KEY_LENGTH = 64

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

export async function hashLocalPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyLocalPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) {
    return false
  }

  const [salt, storedHash] = passwordHash.split(':')

  if (!salt || !storedHash) {
    return false
  }

  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer
  const storedBuffer = Buffer.from(storedHash, 'hex')

  if (derivedKey.length !== storedBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedKey, storedBuffer)
}

export const buildSessionUser = (user: SessionUserSource) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  picture: user.picture,
  role: user.role,
  locale: user.locale
})
