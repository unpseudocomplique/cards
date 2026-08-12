// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxt/content', '@vueuse/nuxt', 'nuxt-auth-utils', 'nuxt-og-image', 'motion-v/nuxt', '@tresjs/nuxt'],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'fr'
      },
      meta: [
        { name: 'theme-color', content: '#1c1612' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  content: {
    experimental: {
      sqliteConnector: 'native'
    }
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    bucketEndpoint: process.env.NUXT_BUCKET_ENDPOINT || process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || '',
    bucketName: process.env.NUXT_BUCKET_NAME || process.env.BUCKET_NAME || process.env.S3_BUCKET_NAME || 'quizwar',
    bucketPublicUrl: process.env.NUXT_BUCKET_PUBLIC_URL || process.env.BUCKET_PUBLIC_URL || process.env.S3_PUBLIC_URL || 'https://s3.quizwar.app',
    minioUser: process.env.MINIO_USER || process.env.S3_ACCESS_KEY_ID || '',
    minioPassword: process.env.MINIO_PASSWORD || process.env.S3_SECRET_ACCESS_KEY || '',
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET || '',
        // Behind Coolify the request host is often `localhost`; never rely on getRequestURL alone.
        redirectURL: process.env.NUXT_OAUTH_GOOGLE_REDIRECT_URL
          || (process.env.NUXT_PUBLIC_SITE_URL
            ? `${String(process.env.NUXT_PUBLIC_SITE_URL).replace(/\/$/, '')}/auth/google`
            : '')
      }
    },
    session: {
      maxAge: 60 * 60 * 24 * 7,
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    email: {
      from: process.env.NUXT_EMAIL_FROM || process.env.EMAIL_FROM || '',
      resendApiKey: process.env.NUXT_EMAIL_RESEND_API_KEY || process.env.EMAIL_RESEND_API_KEY || process.env.RESEND_API_KEY || ''
    },
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3003',
      googleClientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID || '',
      yjsWebsocketUrl: process.env.NUXT_PUBLIC_YJS_WEBSOCKET_URL || 'ws://localhost:1234'
    }
  },
  devServer: {
    port: 3003,
    host: 'localhost'
  },

  compatibilityDate: '2024-11-01',

  routeRules: {
    // OAuth + session routes must never be prerendered (crawlLinks would bake localhost redirect_uri).
    '/auth/**': { prerender: false },
    '/play/salon-cast': { ssr: false, prerender: false }
  },

  nitro: {
    experimental: {
      websocket: true
    },
    serverAssets: [
      {
        baseName: 'fonts',
        dir: './server/assets/fonts'
      }
    ],
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true,
      ignore: ['/auth/**', '/play/salon-cast']
    }
  },

  vite: {
    resolve: {
      // TipTap collaboration + our tarot sync must share one Yjs singleton.
      dedupe: ['yjs', 'lib0', 'y-protocols', 'y-websocket']
    },
    optimizeDeps: {
      include: [
        'browser-image-compression',
        'yjs',
        'y-websocket',
        'lib0',
        'y-protocols'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  ogImage: {
    zeroRuntime: true
  }
})