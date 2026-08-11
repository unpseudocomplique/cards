// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
    'nuxt-og-image',
    'motion-v/nuxt'
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'fr'
      },
      meta: [
        { name: 'theme-color', content: '#0f172a' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

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
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET || ''
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
      crawlLinks: true
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        'browser-image-compression'
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
