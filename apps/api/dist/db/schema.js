"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chefResponses = exports.chefResponseStatusEnum = exports.requests = exports.requestStatusEnum = exports.requestFormatEnum = exports.disputes = exports.disputeResolutionTypeEnum = exports.disputeStatusEnum = exports.disputeOpenedByEnum = exports.reviews = exports.payments = exports.paymentStatusEnum = exports.orders = exports.productsBuyerEnum = exports.orderStatusEnum = exports.orderTypeEnum = exports.chefProfiles = exports.users = exports.verificationStatusEnum = exports.userStatusEnum = exports.userRoleEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ─── Enums ────────────────────────────────────────────────────────────────────
exports.userRoleEnum = (0, pg_core_1.pgEnum)('user_role', [
    'customer',
    'chef',
    'support',
    'admin',
]);
exports.userStatusEnum = (0, pg_core_1.pgEnum)('user_status', ['active', 'banned']);
exports.verificationStatusEnum = (0, pg_core_1.pgEnum)('verification_status', [
    'pending',
    'approved',
    'rejected',
]);
// ─── users ────────────────────────────────────────────────────────────────────
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    role: (0, exports.userRoleEnum)('role').default('customer').notNull(),
    lang: (0, pg_core_1.varchar)('lang', { length: 10 }).default('ru'),
    city: (0, pg_core_1.varchar)('city', { length: 100 }),
    status: (0, exports.userStatusEnum)('status').default('active').notNull(),
    // UTM params for acquisition analytics
    utmSource: (0, pg_core_1.varchar)('utm_source', { length: 100 }),
    utmMedium: (0, pg_core_1.varchar)('utm_medium', { length: 100 }),
    utmCampaign: (0, pg_core_1.varchar)('utm_campaign', { length: 100 }),
    utmContent: (0, pg_core_1.varchar)('utm_content', { length: 100 }),
    utmTerm: (0, pg_core_1.varchar)('utm_term', { length: 100 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// ─── chefprofiles ─────────────────────────────────────────────────────────────
exports.chefProfiles = (0, pg_core_1.pgTable)('chef_profiles', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id')
        .notNull()
        .references(() => exports.users.id),
    bio: (0, pg_core_1.text)('bio'),
    // Stored as text arrays; validated at app layer
    cuisineTags: (0, pg_core_1.text)('cuisine_tags').array().default([]).notNull(),
    // 'home_visit' | 'delivery'
    workFormats: (0, pg_core_1.text)('work_formats').array().default([]).notNull(),
    districts: (0, pg_core_1.text)('districts').array().default([]).notNull(),
    avgPrice: (0, pg_core_1.numeric)('avg_price', { precision: 10, scale: 2 }),
    verificationStatus: (0, exports.verificationStatusEnum)('verification_status')
        .default('pending')
        .notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    // Denormalised cache; updated after each new review
    ratingCache: (0, pg_core_1.numeric)('rating_cache', { precision: 3, scale: 2 }).default('0').notNull(),
    ordersCount: (0, pg_core_1.integer)('orders_count').default(0).notNull(),
    // Telegram file_ids; originals stay on Telegram servers
    portfolioMediaIds: (0, pg_core_1.text)('portfolio_media_ids').array().default([]).notNull(),
    // Verification document file_ids (set when chef submits verification)
    verificationDocumentId: (0, pg_core_1.text)('verification_document_id'),
    verificationSelfieId: (0, pg_core_1.text)('verification_selfie_id'),
});
// ─── orders ───────────────────────────────────────────────────────────────────
exports.orderTypeEnum = (0, pg_core_1.pgEnum)('order_type', ['home_visit', 'delivery']);
exports.orderStatusEnum = (0, pg_core_1.pgEnum)('order_status', [
    'draft',
    'awaiting_payment',
    'paid',
    'in_progress',
    'completed',
    'dispute_pending',
    'refunded',
    'cancelled',
]);
exports.productsBuyerEnum = (0, pg_core_1.pgEnum)('products_buyer', ['customer', 'chef']);
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    customerId: (0, pg_core_1.integer)('customer_id').notNull().references(() => exports.users.id),
    chefId: (0, pg_core_1.integer)('chef_id').notNull().references(() => exports.users.id),
    type: (0, exports.orderTypeEnum)('type').notNull(),
    city: (0, pg_core_1.varchar)('city', { length: 100 }).notNull(),
    district: (0, pg_core_1.varchar)('district', { length: 100 }),
    address: (0, pg_core_1.text)('address'),
    scheduledAt: (0, pg_core_1.timestamp)('scheduled_at').notNull(),
    persons: (0, pg_core_1.integer)('persons').notNull(),
    description: (0, pg_core_1.text)('description'),
    agreedPrice: (0, pg_core_1.numeric)('agreed_price', { precision: 10, scale: 2 }),
    status: (0, exports.orderStatusEnum)('status').default('draft').notNull(),
    // home_visit only
    productsBuyer: (0, exports.productsBuyerEnum)('products_buyer'),
    productsBudget: (0, pg_core_1.numeric)('products_budget', { precision: 10, scale: 2 }),
    chatEnabled: (0, pg_core_1.boolean)('chat_enabled').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    reviewReminderSentAt: (0, pg_core_1.timestamp)('review_reminder_sent_at'),
});
// ─── payments ─────────────────────────────────────────────────────────────────
exports.paymentStatusEnum = (0, pg_core_1.pgEnum)('payment_status', [
    'created',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
]);
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id').notNull().references(() => exports.orders.id),
    amount: (0, pg_core_1.numeric)('amount', { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 10 }).default('GEL').notNull(),
    provider: (0, pg_core_1.varchar)('provider', { length: 50 }).notNull(),
    status: (0, exports.paymentStatusEnum)('status').default('created').notNull(),
    providerTxId: (0, pg_core_1.varchar)('provider_tx_id', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// ─── reviews ──────────────────────────────────────────────────────────────────
exports.reviews = (0, pg_core_1.pgTable)('reviews', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id').notNull().unique().references(() => exports.orders.id),
    authorId: (0, pg_core_1.integer)('author_id').notNull().references(() => exports.users.id),
    chefId: (0, pg_core_1.integer)('chef_id').notNull().references(() => exports.users.id),
    rating: (0, pg_core_1.integer)('rating').notNull(),
    tagsQuality: (0, pg_core_1.text)('tags_quality').array().default([]).notNull(),
    text: (0, pg_core_1.text)('text'),
    photoIds: (0, pg_core_1.text)('photo_ids').array().default([]).notNull(),
    chefReply: (0, pg_core_1.text)('chef_reply'),
    isHidden: (0, pg_core_1.boolean)('is_hidden').default(false).notNull(),
    reportCount: (0, pg_core_1.integer)('report_count').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// ─── disputes ─────────────────────────────────────────────────────────────────
exports.disputeOpenedByEnum = (0, pg_core_1.pgEnum)('dispute_opened_by', [
    'customer',
    'chef',
]);
exports.disputeStatusEnum = (0, pg_core_1.pgEnum)('dispute_status', [
    'open',
    'awaiting_other_party',
    'support_review',
    'resolved',
]);
exports.disputeResolutionTypeEnum = (0, pg_core_1.pgEnum)('dispute_resolution_type', [
    'full_refund',
    'partial_refund',
    'no_refund',
]);
exports.disputes = (0, pg_core_1.pgTable)('disputes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id').notNull().references(() => exports.orders.id),
    openedBy: (0, exports.disputeOpenedByEnum)('opened_by').notNull(),
    reasonCode: (0, pg_core_1.varchar)('reason_code', { length: 100 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    attachments: (0, pg_core_1.text)('attachments').array().default([]).notNull(),
    status: (0, exports.disputeStatusEnum)('status').default('open').notNull(),
    resolutionType: (0, exports.disputeResolutionTypeEnum)('resolution_type'),
    resolutionComment: (0, pg_core_1.text)('resolution_comment'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// ─── requests ─────────────────────────────────────────────────────────────────
exports.requestFormatEnum = (0, pg_core_1.pgEnum)('request_format', [
    'home_visit',
    'delivery',
]);
exports.requestStatusEnum = (0, pg_core_1.pgEnum)('request_status', ['open', 'closed']);
exports.requests = (0, pg_core_1.pgTable)('requests', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    customerId: (0, pg_core_1.integer)('customer_id').notNull().references(() => exports.users.id),
    city: (0, pg_core_1.varchar)('city', { length: 100 }).notNull(),
    district: (0, pg_core_1.varchar)('district', { length: 100 }),
    scheduledAt: (0, pg_core_1.timestamp)('scheduled_at').notNull(),
    format: (0, exports.requestFormatEnum)('format').notNull(),
    persons: (0, pg_core_1.integer)('persons').notNull(),
    description: (0, pg_core_1.text)('description'),
    budget: (0, pg_core_1.numeric)('budget', { precision: 10, scale: 2 }),
    status: (0, exports.requestStatusEnum)('status').default('open').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// ─── chef_responses ───────────────────────────────────────────────────────────
exports.chefResponseStatusEnum = (0, pg_core_1.pgEnum)('chef_response_status', [
    'new',
    'accepted',
    'rejected',
]);
exports.chefResponses = (0, pg_core_1.pgTable)('chef_responses', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    requestId: (0, pg_core_1.integer)('request_id').notNull().references(() => exports.requests.id),
    chefId: (0, pg_core_1.integer)('chef_id').notNull().references(() => exports.users.id),
    proposedPrice: (0, pg_core_1.numeric)('proposed_price', { precision: 10, scale: 2 }),
    comment: (0, pg_core_1.text)('comment'),
    status: (0, exports.chefResponseStatusEnum)('status').default('new').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
