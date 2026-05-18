import { and, eq, or } from 'drizzle-orm'
import { buildSessionUser, normalizeEmail, sanitizeInternalRedirect } from '~~/server/utils/auth'
import { db, users } from '~~/server/utils/db'

export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['email', 'profile']
  },

  async onSuccess(event, { user: googleUser, tokens }) {
    const email = normalizeEmail(googleUser.email)

    const existingUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, email),
          and(
            eq(users.provider, 'google'),
            eq(users.providerUserId, googleUser.sub)
          )
        )
      )
      .limit(1)

    let appUser = existingUsers[0]

    if (!appUser) {
      const [createdUser] = await db
        .insert(users)
        .values({
          email,
          username: googleUser.name || email.split('@')[0] || 'Utilisateur',
          picture: googleUser.picture,
          provider: 'google',
          providerUserId: googleUser.sub,
          emailVerifiedAt: googleUser.email_verified ? new Date() : null,
          lastLoginAt: new Date(),
          locale: googleUser.locale || 'fr-FR'
        })
        .returning()

      appUser = createdUser
    } else {
      const [updatedUser] = await db
        .update(users)
        .set({
          picture: googleUser.picture || appUser.picture,
          provider: appUser.provider || 'google',
          providerUserId: appUser.providerUserId || googleUser.sub,
          emailVerifiedAt: googleUser.email_verified ? new Date() : appUser.emailVerifiedAt,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, appUser.id))
        .returning()

      appUser = updatedUser
    }

    if (!appUser || !appUser.isActive) {
      throw createError({
        status: 403,
        statusText: 'Compte désactivé'
      })
    }

    await setUserSession(event, {
      user: buildSessionUser(appUser),
      secure: {
        providerAccessToken: tokens.access_token,
        providerRefreshToken: tokens.refresh_token
      },
      loggedInAt: Date.now()
    })

    const redirectTo = sanitizeInternalRedirect(getCookie(event, 'auth-redirect'))
    deleteCookie(event, 'auth-redirect', { path: '/' })

    return sendRedirect(event, redirectTo)
  },

  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/auth/login?error=oauth_failed')
  }
})
