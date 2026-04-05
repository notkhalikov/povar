# Known Issues & Limitations

## Security

- **JWT_SECRET length**: Railway env var must be ≥ 32 random characters. Generate with:
  `openssl rand -base64 32`
  Short secrets are accepted by the server but are cryptographically weak.

- **ADMIN_TELEGRAM_ID not validated**: `POST /chefs/me/verify` sends a Telegram notification to `ADMIN_TELEGRAM_ID` from env. If the var is unset the notification is silently skipped (no error), but admin will never see the request.

## Payments

- **Stars (XTR) only**: Telegram Payments currently only supports Telegram Stars. Fiat currency (GEL) requires a third-party payment provider (e.g. Stripe). This is planned for a future sprint.

- **No automatic refund flow**: Disputes resolved as `full_refund` or `partial_refund` require manual payout via admin. Automatic refund API is not yet implemented.

## Verification

- **Document storage via file_id only**: Verification photos are stored as Telegram `file_id`s, which expire after a bot session and cannot be re-downloaded after the bot restarts. Production should migrate to S3/R2 storage.

- **No re-submit after rejection cooldown**: Chefs can re-submit verification immediately after rejection with no cooldown period.

## UX / Frontend

- **No push notifications**: Order status changes notify the user via Telegram bot message, but there is no in-app push / badge update. The user must open the app to see updated status.

- **Catalog pagination**: Infinite scroll loads 20 items per page. Very large catalogs (>200 chefs) may feel slow on first load if the DB lacks proper indexes on `ratingCache` and `city`.

## Infrastructure

- **No DB connection pooling**: The API uses a direct `postgres` connection without PgBouncer. Under high load (>50 concurrent requests) this may exhaust PostgreSQL connection limits. Mitigation: set `max: 10` in the postgres client, or add PgBouncer on Railway.

- **No Redis / queue**: Telegram notifications are sent synchronously inside route handlers. If the Telegram API is slow, this adds latency to every request that triggers a notification. Planned fix: async job queue (BullMQ or similar).
