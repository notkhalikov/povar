# Повар

Telegram Mini App + Bot — маркетплейс домашних поваров в Тбилиси и Батуми.
Пользователи находят поваров и заказывают домашнюю еду прямо в Telegram.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│  Telegram                                                       │
│  ┌──────────────┐    initData / payments    ┌────────────────┐  │
│  │  Mini App    │ ◄──────────────────────── │   Bot (grammY) │  │
│  │ (Vercel)     │                           │   (Railway)    │  │
│  └──────┬───────┘                           └───────┬────────┘  │
│         │  REST API (JWT)                           │ webhook   │
└─────────┼─────────────────────────────────────────┼───────────┘
          ▼                                          ▼
    ┌─────────────────────────────────────────────────────┐
    │              API  —  Fastify + Drizzle              │
    │                    (Railway)                        │
    └────────────────────────┬────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Railway)     │
                    └─────────────────┘
```

| Приложение    | Стек                               | Деплой   |
|---------------|------------------------------------|----------|
| `apps/api`    | Fastify · TypeScript · Drizzle ORM | Railway  |
| `apps/bot`    | grammY · TypeScript                | Railway  |
| `apps/web`    | React · Vite · @twa-dev/sdk        | Vercel   |
| `apps/admin`  | React · Vite                       | Vercel   |

**Поток авторизации:** Mini App получает `initData` от Telegram → отправляет на `POST /auth/telegram` → API проверяет HMAC-подпись → возвращает JWT → все последующие запросы идут с `Authorization: Bearer <token>`.

**Поток оплаты:** Mini App создаёт счёт через `POST /orders/:id/invoice` → API вызывает `createInvoiceLink` Telegram Bot API → пользователь платит в Telegram → бот получает `successful_payment` и вызывает `POST /payments/telegram-webhook` → API переводит заказ в статус `paid`.

---

## Запуск локально

### Требования

- Node.js 20+
- Docker (для PostgreSQL)

### Шаги

```bash
# 1. Клонировать и установить зависимости
git clone <repo>
cd povar-bot
npm install

# 2. Запустить PostgreSQL
docker-compose up -d

# 3. Скопировать и заполнить env-файлы
cp .env.example .env
# отредактировать .env — минимум BOT_TOKEN, DATABASE_URL, JWT_SECRET

# 4. Применить миграции и сидировать БД
npm run db:migrate --workspace=apps/api
npm run db:seed    --workspace=apps/api

# 5. Запустить все сервисы
npm run dev:api    # http://localhost:3000
npm run dev:web    # http://localhost:5173
npm run dev:bot
```

> **Совет:** Для тестирования Mini App локально используй [Ngrok](https://ngrok.com/) или [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) для проброса `localhost:5173`.

---

## Деплой

### API + Bot → Railway

1. Создай два сервиса в Railway: `api` и `bot`.
2. Добавь PostgreSQL через Railway Plugins.
3. Установи переменные окружения (см. таблицу ниже).
4. Railway автоматически запускает `npm run build && npm start` для каждого сервиса.

### Web + Admin → Vercel

1. Подключи репозиторий к Vercel.
2. **Root Directory:** `apps/web` (или `apps/admin` для второго проекта).
3. **Build command:** `npm run build`
4. **Output directory:** `dist`
5. Установи `VITE_BASE_URL` на Railway URL API.

---

## Переменные окружения

### `apps/api`

| Переменная        | Обязательная | Описание |
|-------------------|:---:|---|
| `DATABASE_URL`    | ✅ | PostgreSQL connection string |
| `JWT_SECRET`      | ✅ | Секрет для подписи JWT (минимум 32 символа) |
| `BOT_TOKEN`       | ✅ | Токен бота из BotFather |
| `PAYMENTS_TOKEN`  | ✅ | Токен Telegram Payments от провайдера |
| `WEBHOOK_SECRET`  | ✅ | Shared secret для `POST /payments/telegram-webhook` |
| `CORS_ORIGIN`     | — | Разрешённые origins через запятую; в проде без этой переменной разрешается только Vercel домен |
| `PORT`            | — | Порт (по умолчанию `3000`) |
| `SENTRY_DSN`      | — | DSN из sentry.io для отслеживания ошибок |

### `apps/bot`

| Переменная        | Обязательная | Описание |
|-------------------|:---:|---|
| `BOT_TOKEN`       | ✅ | Токен бота из BotFather |
| `API_BASE_URL`    | ✅ | URL API (`https://<railway-api-domain>`) |
| `WEBHOOK_SECRET`  | ✅ | Совпадает с API |

### `apps/web` / `apps/admin`

| Переменная        | Обязательная | Описание |
|-------------------|:---:|---|
| `VITE_BASE_URL`   | ✅ | URL API (пусто = Vite proxy в dev-режиме) |

---

## Полезные команды

```bash
# Сборка всех воркспейсов
npm run build

# Проверка типов
npm run typecheck

# Линтинг
npm run lint

# Создать first admin (запускать после первого деплоя)
cd apps/api && npx tsx src/db/seed-production.ts <your_telegram_id>

# Применить миграции БД
cd apps/api && npm run db:migrate
```

---

## Документация

- [`docs/launch-checklist.md`](docs/launch-checklist.md) — чеклист перед запуском
- [`docs/01-product-vision.md`](docs/01-product-vision.md) — продуктовое видение
- [`docs/02-entities-and-domain.md`](docs/02-entities-and-domain.md) — сущности и домен
- [`docs/03-user-stories.md`](docs/03-user-stories.md) — пользовательские истории
- [`docs/04-architecture-plan.md`](docs/04-architecture-plan.md) — план архитектуры
