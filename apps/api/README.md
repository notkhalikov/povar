# @povar/api — Backend

REST API маркетплейса домашних поваров. Fastify + TypeScript + PostgreSQL (Drizzle ORM).

## Запуск

```bash
cp .env.example .env   # настрой переменные окружения
npm install
npm run db:generate    # сгенерировать SQL-миграции из schema.ts
npm run db:migrate     # применить миграции к БД
npm run dev            # dev-сервер с hot-reload (tsx watch)
```

## Структура

```
src/
  main.ts              # bootstrap Fastify: регистрация плагинов и роутов
  plugins/
    db.ts              # postgres.js + Drizzle, декоратор app.db
    auth.ts            # @fastify/jwt + декоратор app.authenticate
    cors.ts            # @fastify/cors
  routes/
    auth.ts            # POST /auth/telegram
    chefs.ts           # GET /chefs, GET /chefs/:id, PATCH /chefs/me
  services/
    telegram-auth.ts   # HMAC-валидация Telegram initData
  db/
    schema.ts          # Drizzle-схема: users, chef_profiles
    migrate.ts         # runner миграций (npm run db:migrate)
    migrations/        # SQL-файлы, генерируются drizzle-kit
  types/
    index.ts           # domain types
```

## Эндпоинты (Этап 1)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/telegram` | — | Валидация initData → JWT |
| `GET` | `/chefs` | — | Каталог поваров (фильтры: city, district, cuisine, format, sort) |
| `GET` | `/chefs/:id` | — | Профиль повара |
| `PATCH` | `/chefs/me` | JWT | Создать / обновить анкету повара |

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `JWT_SECRET` | Секрет для подписи JWT (≥32 символа) |
| `BOT_TOKEN` | Токен бота — нужен для валидации initData |
| `CORS_ORIGIN` | Домен Mini App (в dev можно не задавать) |
| `PORT` | Порт сервера (по умолчанию 3000) |
