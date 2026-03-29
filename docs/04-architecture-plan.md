# Architecture Plan

## Стек и границы компонентов

```
┌─────────────────────────────────────────────────┐
│               Telegram clients                  │
│   Mini App (web)          Bot chat              │
└────────────┬──────────────────┬────────────────-┘
             │ HTTPS             │ Telegram Bot API
             ▼                  ▼
┌─────────────────────────────────────────────────┐
│              apps/api  (Fastify + TS)           │
│  Auth │ Chefs │ Orders │ Payments │ Disputes … │
└───────────────────────┬─────────────────────────┘
                        │ postgres driver
                        ▼
              PostgreSQL (single DB)
```

- **apps/api** — единственный источник истины; бот и фронт идут только через него.
- **apps/bot** — тонкая обёртка: уведомления + команды + deep-links в Mini App. БД напрямую не трогает.
- **apps/web** — Telegram Mini App, авторизация через `initData`.
- **apps/admin** — отдельный React SPA, отдельные `/api/admin/*` эндпоинты с JWT-авторизацией.

---

## Backend (apps/api)

### Схема БД

```
users
  id, telegram_id, name, role (customer|chef|support|admin),
  lang, city, status (active|banned), utm_*, created_at

chef_profiles
  id, user_id FK, bio, cuisine_tags[], work_formats[],
  districts[], avg_price, verification_status, is_active,
  rating_cache, orders_count, portfolio_media_ids[]

orders
  id, customer_id FK, chef_id FK, type (home_visit|delivery),
  city, district, address, scheduled_at, persons,
  description, agreed_price,
  status (draft|awaiting_payment|paid|in_progress|
          completed|dispute_pending|refunded|cancelled),
  -- home_visit only:
  products_buyer (customer|chef), products_budget,
  created_at, updated_at

payments
  id, order_id FK, amount, currency, provider,
  status (created|paid|failed|refunded|partially_refunded),
  provider_tx_id, created_at, updated_at

disputes
  id, order_id FK, opened_by (customer|chef),
  reason_code, description, attachment_ids[],
  status (open|awaiting_other_party|support_review|resolved),
  resolution_type (full_refund|partial_refund|no_refund),
  resolution_comment, created_at, updated_at

reviews
  id, order_id FK UNIQUE, author_id FK, chef_id FK,
  rating (1–5), quality_tags[], text, photo_ids[],
  created_at

requests            -- запрос на подбор повара
  id, customer_id FK, city, district, scheduled_at,
  format (home_visit|delivery), persons, description,
  budget, status (open|closed), created_at

chef_responses
  id, request_id FK, chef_id FK,
  proposed_price, comment,
  status (new|accepted|rejected), created_at
```

### Структура кода

```
apps/api/src/
  main.ts                 # bootstrap Fastify
  plugins/
    db.ts                 # postgres пул (postgres.js)
    auth.ts               # валидация Telegram initData + JWT
    cors.ts
  routes/
    auth.ts               # POST /auth/telegram
    chefs.ts              # GET /chefs, GET /chefs/:id, PATCH /chefs/me
    orders.ts             # CRUD /orders
    payments.ts           # POST /payments/invoice, webhook
    disputes.ts           # CRUD /disputes
    reviews.ts            # POST /reviews
    requests.ts           # CRUD /requests + /requests/:id/responses
    admin/
      index.ts            # POST /admin/auth
      chefs.ts            # верификация, бан
      orders.ts           # просмотр, ручная смена статуса
      disputes.ts         # resolution
      users.ts
  services/
    telegram-auth.ts      # HMAC-валидация initData
    order-state.ts        # state machine заказа
    payment.ts            # Telegram Payments / локальный провайдер
    notification.ts       # отправка сообщений через бота
    payout.ts             # логика выплат повару после completed
  db/
    migrations/           # SQL-файлы или Drizzle migrations
    schema.ts             # типы таблиц (если Drizzle)
  types/
    index.ts
```

### Ключевые архитектурные решения

| Вопрос | Решение | Почему |
|--------|---------|--------|
| ORM | **Drizzle ORM** | TypeScript-first, близко к SQL, легко писать миграции |
| Auth | Telegram initData HMAC → JWT (1 день TTL) | Стандарт для Mini App; JWT нужен для бота и фронта |
| Платежи | Telegram Payments (Stars или провайдер) | Нативно в Telegram, не нужен отдельный эквайринг |
| Удержание средств | Логический «холд» в поле payment.status | Telegram Payments не поддерживает настоящее эскроу — реализуем логически |
| Уведомления | Бот шлёт сообщения через Telegram Bot API по `telegram_id` | Просто, надёжно; не нужен push-сервис |
| Файлы (фото) | Сохраняем `file_id` Telegram, не храним бинарники | Telegram хранит медиа, мы только ссылки |

---

## Telegram Mini App (apps/web)

### Страницы и навигация

```
/                    → каталог поваров (фильтры + карточки)
/chefs/:id           → профиль повара (портфолио, отзывы, кнопка «Заказать»)
/orders              → мои заказы (список)
/orders/:id          → детали заказа (статус, оплата, спор, отзыв)
/orders/new          → форма создания заказа
/requests            → мои запросы / лента запросов (для повара)
/requests/new        → форма создания запроса
/requests/:id        → отклики на запрос
/profile             → профиль пользователя / анкета повара
```

### Auth flow

```
1. WebApp.initData → POST /auth/telegram → JWT
2. JWT хранить в sessionStorage (не localStorage — Mini App закрывается)
3. Все API-запросы: Authorization: Bearer <jwt>
```

### Telegram WebApp интеграция

- `WebApp.ready()` — первый вызов в `main.tsx`
- `WebApp.MainButton` — кнопки «Оплатить», «Подтвердить завершение»
- `WebApp.BackButton` — навигация назад вместо браузерного back
- `WebApp.themeParams` + CSS-переменные — нативный Telegram-стиль
- `WebApp.openInvoice()` — оплата заказа

---

## Telegram Bot (apps/bot)

Бот — **тонкий слой**: команды + нотификации + переход в Mini App.

### Команды

```
/start    → приветствие + кнопка открыть Mini App
/orders   → краткий список активных заказов (deep link в Mini App)
/help     → справка
```

### Уведомления (push от API через NotificationService)

| Событие | Кому |
|---------|------|
| Новый заказ | повару |
| Заказ оплачен | повару |
| Новый запрос (по фильтру) | поварам |
| Отклик принят | повару |
| Заказ завершён, просьба подтвердить | заказчику |
| Напоминание об отзыве (через N ч) | заказчику |
| Спор открыт | второй стороне + support |
| Спор разрешён | обеим сторонам |
| Автоконфирм через 24 ч без действий | заказчику (предупреждение) |

### Deep links

Все кнопки в уведомлениях — `InlineKeyboardButton` с URL вида:
`https://t.me/<bot>/<app>?startapp=order_<id>`

---

## Admin (apps/admin)

```
/                → дашборд (новые заявки, открытые споры, выручка сегодня)
/chefs           → список поваров, верификация (approve/reject), бан
/orders          → все заказы с фильтрами и ручной сменой статуса
/disputes        → открытые споры, форма resolution
/users           → пользователи, бан
```

Auth: форма логин/пароль → `POST /api/admin/auth` → JWT с ролью `admin`.

---

## Этапы MVP (приоритеты)

### Этап 1 — Фундамент (≈1–2 недели)
**Цель: первый рабочий экран в Telegram**

- [ ] DB: миграции для `users`, `chef_profiles`
- [ ] API: `POST /auth/telegram` (валидация initData, выдача JWT)
- [ ] API: `GET /chefs` (список с фильтрами), `GET /chefs/:id`
- [ ] API: `PATCH /chefs/me` (заполнить анкету повара)
- [ ] Web: страница каталога `/` + страница профиля `/chefs/:id`
- [ ] Web: auth flow (initData → JWT → запросы)
- [ ] Bot: `/start` + кнопка открыть Mini App

**Результат:** зайти в бот → открыть Mini App → видеть список поваров.

---

### Этап 2 — Заказ и оплата (≈2–3 недели)
**Цель: сквозной путь заказчик → повар → деньги**

- [ ] DB: миграции `orders`, `payments`
- [ ] API: CRUD `/orders`, `POST /payments/invoice`, Telegram Payments webhook
- [ ] API: смена статусов заказа (state machine)
- [ ] Web: форма создания заказа, список заказов, детали заказа + оплата (`WebApp.openInvoice`)
- [ ] Web: экран «Подтвердить завершение / Открыть спор»
- [ ] Bot: уведомления о новом заказе, оплате, завершении

**Результат:** полный платёжный цикл внутри Telegram.

---

### Этап 3 — Доверие (≈1–2 недели)
**Цель: рейтинги и защита сторон**

- [ ] DB: `reviews`, `disputes`
- [ ] API: `POST /reviews`, CRUD `/disputes`
- [ ] API: логика выплаты повару (только после `completed` или автоконфирм через 24 ч)
- [ ] Web: экран отзыва (рейтинг + теги + фото), форма спора
- [ ] Bot: напоминание об отзыве, уведомления о споре

**Результат:** защищённые сделки, накопление репутации.

---

### Этап 4 — Подбор повара (≈1 неделя)
**Цель: второй сценарий работы с запросами**

- [ ] DB: `requests`, `chef_responses`
- [ ] API: CRUD `/requests`, `POST /requests/:id/responses`
- [ ] Web: форма запроса, лента запросов для повара, просмотр откликов, создание заказа из отклика
- [ ] Bot: уведомление поварам о новых релевантных запросах

**Результат:** заказчик может не выбирать повара сам — повара откликаются.

---

### Этап 5 — Админка (≈1 неделя)
**Цель: операционный контроль**

- [ ] Admin auth (JWT с ролью admin)
- [ ] Верификация поваров (approve/reject анкет)
- [ ] Просмотр и ручное разрешение споров
- [ ] Базовые фильтры по заказам и пользователям

---

## Что отложить после MVP

- Push-уведомления вне Telegram (email, FCM)
- Реальное эскроу через платёжного провайдера
- Поиск по карте (геолокация)
- Мультиязычность (i18n)
- Аналитика / BI-дашборд
- Программа лояльности
