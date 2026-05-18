declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    username: string
    picture: string | null
    role: 'USER' | 'ADMIN'
    locale: string
  }

  interface SecureSessionData {
    providerAccessToken?: string
    providerRefreshToken?: string
  }
}

export {}
