import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique
} from 'drizzle-orm/pg-core'

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN'])
export const authTokenPurposeEnum = pgEnum('auth_token_purpose', ['EMAIL_VERIFICATION', 'PASSWORD_RESET'])
export const deckTypeEnum = pgEnum('deck_type', ['classic52', 'tarot56', 'tarot78'])
export const deckStatusEnum = pgEnum('deck_status', ['draft', 'queued', 'generating', 'ready', 'failed'])
export const cardStatusEnum = pgEnum('card_status', ['pending', 'queued', 'generating', 'ready', 'failed'])
export const generationJobStatusEnum = pgEnum('generation_job_status', ['queued', 'running', 'completed', 'failed'])
export const exportTypeEnum = pgEnum('export_type', ['images', 'zip', 'pdf'])
export const exportJobStatusEnum = pgEnum('export_job_status', ['queued', 'running', 'ready', 'failed'])

export type DeckStyleSettings = {
  allowPhotoReuse: boolean
  visualStyle: string
  rolePrompts?: Partial<Record<'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse', string>>
  suitPrompts?: Partial<Record<'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps', string>>
  cardBackPrompt?: string
  cardBackImageUrl?: string | null
  cardBackImageKey?: string | null
  cardBackFoilUrl?: string | null
  cardBackFoilKey?: string | null
}

export type DeckCardMetadata = {
  label: string
  shortLabel: string
  suit?: string
  rank?: string
  role?: string
  sortOrder: number
  aspectRatio: '3:4' | '9:16'
  promptHint: string
}

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  picture: text('picture'),
  role: userRoleEnum('role').default('USER').notNull(),
  provider: text('provider'),
  providerUserId: text('provider_user_id'),
  passwordHash: text('password_hash'),
  locale: text('locale').default('fr-FR').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
  passwordUpdatedAt: timestamp('password_updated_at'),
  emailVerifiedAt: timestamp('email_verified_at')
}, table => [
  unique().on(table.provider, table.providerUserId),
  index('users_email_idx').on(table.email)
])

export const authTokens = pgTable('auth_tokens', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: authTokenPurposeEnum('purpose').notNull(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, table => [
  index('auth_tokens_user_id_idx').on(table.userId),
  index('auth_tokens_purpose_idx').on(table.purpose, table.expiresAt),
  index('auth_tokens_used_at_idx').on(table.usedAt)
])

export const decks = pgTable('decks', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: deckTypeEnum('type').notNull(),
  status: deckStatusEnum('status').default('draft').notNull(),
  settings: jsonb('settings').$type<DeckStyleSettings>().notNull().default({
    allowPhotoReuse: true,
    visualStyle: 'illustration royale contemporaine'
  }),
  cardCount: integer('card_count').default(0).notNull(),
  readyCardCount: integer('ready_card_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at')
}, table => [
  index('decks_user_id_idx').on(table.userId),
  index('decks_status_idx').on(table.status),
  index('decks_deleted_at_idx').on(table.deletedAt)
])

export const deckPersons = pgTable('deck_persons', {
  id: id(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, table => [
  index('deck_persons_deck_id_idx').on(table.deckId),
  index('deck_persons_user_id_idx').on(table.userId)
])

export const deckPhotos = pgTable('deck_photos', {
  id: id(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  personId: text('person_id').references(() => deckPersons.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  originalFilename: text('original_filename'),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, table => [
  index('deck_photos_deck_id_idx').on(table.deckId),
  index('deck_photos_user_id_idx').on(table.userId),
  index('deck_photos_person_id_idx').on(table.personId)
])

export const deckCards = pgTable('deck_cards', {
  id: id(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourcePhotoId: text('source_photo_id').references(() => deckPhotos.id, { onDelete: 'set null' }),
  sourcePersonId: text('source_person_id').references(() => deckPersons.id, { onDelete: 'set null' }),
  cardCode: text('card_code').notNull(),
  status: cardStatusEnum('status').default('pending').notNull(),
  metadata: jsonb('metadata').$type<DeckCardMetadata>().notNull(),
  prompt: text('prompt'),
  rawImageKey: text('raw_image_key'),
  rawImageUrl: text('raw_image_url'),
  finalImageKey: text('final_image_key'),
  finalImageUrl: text('final_image_url'),
  errorMessage: text('error_message'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, table => [
  unique().on(table.deckId, table.cardCode),
  index('deck_cards_deck_id_idx').on(table.deckId),
  index('deck_cards_user_id_idx').on(table.userId),
  index('deck_cards_status_idx').on(table.status),
  index('deck_cards_source_person_id_idx').on(table.sourcePersonId)
])

export const generationJobs = pgTable('generation_jobs', {
  id: id(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: generationJobStatusEnum('status').default('queued').notNull(),
  totalCards: integer('total_cards').default(0).notNull(),
  completedCards: integer('completed_cards').default(0).notNull(),
  failedCards: integer('failed_cards').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, table => [
  index('generation_jobs_deck_id_idx').on(table.deckId),
  index('generation_jobs_user_id_idx').on(table.userId),
  index('generation_jobs_status_idx').on(table.status)
])

export const exportJobs = pgTable('export_jobs', {
  id: id(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: exportTypeEnum('type').notNull(),
  status: exportJobStatusEnum('status').default('queued').notNull(),
  storageKey: text('storage_key'),
  url: text('url'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, table => [
  index('export_jobs_deck_id_idx').on(table.deckId),
  index('export_jobs_user_id_idx').on(table.userId),
  index('export_jobs_status_idx').on(table.status)
])
