import {
  pgTable,
  serial,
  bigint,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'chef',
  'support',
  'admin',
])

export const userStatusEnum = pgEnum('user_status', ['active', 'banned'])

export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'approved',
  'rejected',
])

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('customer').notNull(),
  lang: varchar('lang', { length: 10 }).default('ru'),
  city: varchar('city', { length: 100 }),
  status: userStatusEnum('status').default('active').notNull(),
  // UTM params for acquisition analytics
  utmSource: varchar('utm_source', { length: 100 }),
  utmMedium: varchar('utm_medium', { length: 100 }),
  utmCampaign: varchar('utm_campaign', { length: 100 }),
  utmContent: varchar('utm_content', { length: 100 }),
  utmTerm: varchar('utm_term', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ─── chefprofiles ─────────────────────────────────────────────────────────────

export const chefProfiles = pgTable('chef_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  bio: text('bio'),
  // Stored as text arrays; validated at app layer
  cuisineTags: text('cuisine_tags').array().default([]).notNull(),
  // 'home_visit' | 'delivery'
  workFormats: text('work_formats').array().default([]).notNull(),
  districts: text('districts').array().default([]).notNull(),
  avgPrice: numeric('avg_price', { precision: 10, scale: 2 }),
  verificationStatus: verificationStatusEnum('verification_status')
    .default('pending')
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Denormalised cache; updated after each new review
  ratingCache: numeric('rating_cache', { precision: 3, scale: 2 }).default('0').notNull(),
  ordersCount: integer('orders_count').default(0).notNull(),
  // Telegram file_ids; originals stay on Telegram servers
  portfolioMediaIds: text('portfolio_media_ids').array().default([]).notNull(),
  // Verification document file_ids (set when chef submits verification)
  verificationDocumentId: text('verification_document_id'),
  verificationSelfieId: text('verification_selfie_id'),
})

export type ChefProfile = typeof chefProfiles.$inferSelect
export type NewChefProfile = typeof chefProfiles.$inferInsert

// ─── orders ───────────────────────────────────────────────────────────────────

export const orderTypeEnum = pgEnum('order_type', ['home_visit', 'delivery'])

export const orderStatusEnum = pgEnum('order_status', [
  'draft',
  'awaiting_payment',
  'paid',
  'in_progress',
  'completed',
  'dispute_pending',
  'refunded',
  'cancelled',
])

export const productsBuyerEnum = pgEnum('products_buyer', ['customer', 'chef'])

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  chefId: integer('chef_id').notNull().references(() => users.id),
  type: orderTypeEnum('type').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  district: varchar('district', { length: 100 }),
  address: text('address'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  persons: integer('persons').notNull(),
  description: text('description'),
  agreedPrice: numeric('agreed_price', { precision: 10, scale: 2 }),
  status: orderStatusEnum('status').default('draft').notNull(),
  // home_visit only
  productsBuyer: productsBuyerEnum('products_buyer'),
  productsBudget: numeric('products_budget', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

// ─── payments ─────────────────────────────────────────────────────────────────

export const paymentStatusEnum = pgEnum('payment_status', [
  'created',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
])

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('GEL').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  status: paymentStatusEnum('status').default('created').notNull(),
  providerTxId: varchar('provider_tx_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Payment = typeof payments.$inferSelect

// ─── reviews ──────────────────────────────────────────────────────────────────

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().unique().references(() => orders.id),
  authorId: integer('author_id').notNull().references(() => users.id),
  chefId: integer('chef_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  tagsQuality: text('tags_quality').array().default([]).notNull(),
  text: text('text'),
  photoIds: text('photo_ids').array().default([]).notNull(),
  chefReply: text('chef_reply'),
  isHidden: boolean('is_hidden').default(false).notNull(),
  reportCount: integer('report_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert

// ─── disputes ─────────────────────────────────────────────────────────────────

export const disputeOpenedByEnum = pgEnum('dispute_opened_by', [
  'customer',
  'chef',
])

export const disputeStatusEnum = pgEnum('dispute_status', [
  'open',
  'awaiting_other_party',
  'support_review',
  'resolved',
])

export const disputeResolutionTypeEnum = pgEnum('dispute_resolution_type', [
  'full_refund',
  'partial_refund',
  'no_refund',
])

export const disputes = pgTable('disputes', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  openedBy: disputeOpenedByEnum('opened_by').notNull(),
  reasonCode: varchar('reason_code', { length: 100 }).notNull(),
  description: text('description'),
  attachments: text('attachments').array().default([]).notNull(),
  status: disputeStatusEnum('status').default('open').notNull(),
  resolutionType: disputeResolutionTypeEnum('resolution_type'),
  resolutionComment: text('resolution_comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Dispute = typeof disputes.$inferSelect
export type NewDispute = typeof disputes.$inferInsert

// ─── requests ─────────────────────────────────────────────────────────────────

export const requestFormatEnum = pgEnum('request_format', [
  'home_visit',
  'delivery',
])

export const requestStatusEnum = pgEnum('request_status', ['open', 'closed'])

export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  city: varchar('city', { length: 100 }).notNull(),
  district: varchar('district', { length: 100 }),
  scheduledAt: timestamp('scheduled_at').notNull(),
  format: requestFormatEnum('format').notNull(),
  persons: integer('persons').notNull(),
  description: text('description'),
  budget: numeric('budget', { precision: 10, scale: 2 }),
  status: requestStatusEnum('status').default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert

// ─── chef_responses ───────────────────────────────────────────────────────────

export const chefResponseStatusEnum = pgEnum('chef_response_status', [
  'new',
  'accepted',
  'rejected',
])

export const chefResponses = pgTable('chef_responses', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => requests.id),
  chefId: integer('chef_id').notNull().references(() => users.id),
  proposedPrice: numeric('proposed_price', { precision: 10, scale: 2 }),
  comment: text('comment'),
  status: chefResponseStatusEnum('status').default('new').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type ChefResponse = typeof chefResponses.$inferSelect
export type NewChefResponse = typeof chefResponses.$inferInsert
