import { Resend } from 'resend'
import type { H3Event } from 'h3'

type SendEmailBaseOptions = {
  subject: string
  to: string | string[]
}

type SendEmailOptions
  = | (SendEmailBaseOptions & {
    html: string
    text?: string
  })
  | (SendEmailBaseOptions & {
    html?: string
    text: string
  })

const resendCache = new Map<string, Resend>()

export const maskEmailAddress = (value: string) => {
  const [localPart, domainPart = ''] = value.trim().split('@')

  if (!localPart || !domainPart) {
    return '***'
  }

  const visibleLocalPart = localPart.length <= 2
    ? `${localPart[0]}*`
    : `${localPart.slice(0, 2)}***`

  const [domainName, ...domainSuffixParts] = domainPart.split('.')
  const visibleDomainName = domainName
    ? `${domainName.slice(0, 2)}***`
    : '***'
  const domainSuffix = domainSuffixParts.length > 0
    ? `.${domainSuffixParts.join('.')}`
    : ''

  return `${visibleLocalPart}@${visibleDomainName}${domainSuffix}`
}

const maskEmailRecipients = (value: string | string[]) => Array.isArray(value)
  ? value.map(maskEmailAddress)
  : maskEmailAddress(value)

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')

const getBaseUrl = (event: H3Event) => {
  const config = useRuntimeConfig(event)
  return String(config.public.siteUrl || 'http://localhost:3003').replace(/\/$/, '')
}

const getEmailConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event)

  return {
    from: String(config.email.from || '').trim(),
    resendApiKey: String(config.email.resendApiKey || '').trim()
  }
}

export const isEmailConfigured = (event: H3Event) => {
  const config = getEmailConfig(event)
  return Boolean(config.from && config.resendApiKey)
}

const isEmailDeliveryEnabled = () => {
  const rawValue = String(
    process.env.NUXT_EMAIL_DISABLE_DELIVERY
    || process.env.EMAIL_DISABLE_DELIVERY
    || ''
  ).trim().toLowerCase()

  return !['1', 'true', 'yes', 'on'].includes(rawValue)
}

const getResendClient = (event: H3Event) => {
  const { resendApiKey } = getEmailConfig(event)
  const cached = resendCache.get(resendApiKey)

  if (cached) {
    return cached
  }

  const resend = new Resend(resendApiKey)
  resendCache.set(resendApiKey, resend)
  return resend
}

export async function sendEmail(event: H3Event, options: SendEmailOptions) {
  const maskedRecipients = maskEmailRecipients(options.to)

  if (!isEmailDeliveryEnabled()) {
    console.log('[email] Envoi désactivé par configuration.', {
      subject: options.subject,
      to: maskedRecipients
    })
    return false
  }

  if (!isEmailConfigured(event)) {
    console.log('[email] Configuration Resend absente, e-mail non envoyé.', {
      subject: options.subject,
      to: maskedRecipients
    })
    return false
  }

  const { from } = getEmailConfig(event)
  const resend = getResendClient(event)

  const { error } = await resend.emails.send({
    ...options,
    from
  })

  if (error) {
    console.error('[email] Echec envoi Resend.', {
      message: error.message,
      subject: options.subject,
      to: maskedRecipients
    })
    throw new Error(error.message)
  }

  console.log('[email] E-mail envoye avec succes.', {
    subject: options.subject,
    to: maskedRecipients
  })

  return true
}

export function buildAuthActionUrl(event: H3Event, path: string, token: string) {
  const url = new URL(path, getBaseUrl(event))
  url.searchParams.set('token', token)
  return url.toString()
}

export async function sendPasswordResetEmail(event: H3Event, options: {
  to: string
  token: string
  username: string
}) {
  const href = buildAuthActionUrl(event, '/auth/reset-password', options.token)
  const subject = 'Réinitialisation de votre mot de passe'
  const username = escapeHtml(options.username)
  const actionHref = escapeHtml(href)

  const html = `
    <div style="margin:0;background:#f8fafc;padding:32px 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 28px 12px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;">Réinitialiser votre mot de passe</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">
            Bonjour <strong>${username}</strong>, utilisez le bouton ci-dessous pour choisir un nouveau mot de passe.
            Ce lien est valable 30 minutes.
          </p>
        </div>
        <div style="padding:12px 28px 28px;">
          <a href="${actionHref}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
            Choisir un nouveau mot de passe
          </a>
          <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;word-break:break-all;">
            Si le bouton ne fonctionne pas, copiez ce lien :<br />
            <a href="${actionHref}" style="color:#2563eb;">${actionHref}</a>
          </p>
        </div>
      </div>
    </div>
  `

  const text = [
    subject,
    '',
    `Bonjour ${options.username},`,
    'Utilisez ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :',
    href
  ].join('\n')

  return sendEmail(event, {
    html,
    subject,
    text,
    to: options.to
  })
}
