# @povar/api — Backend

REST API для маркетплейса домашних поваров. Fastify + TypeScript + PostgreSQL.

## Запуск

```bash
cp .env.example .env   # настрой переменные окружения
npm install
npm run dev            # dev-сервер с hot-reload (tsx watch)
```

## Структура

```
src/
  main.ts          # точка входа, инициализация Fastify
  routes/          # маршруты по доменным областям (cooks, orders, dishes, …)
  plugins/         # Fastify-плагины (auth, db, cors)
  db/              # клиент postgres + схема миграций
  services/        # бизнес-логика
  types/           # общие TypeScript-типы
```

## Переменные окружения

| Переменная     | Описание                        |
|----------------|---------------------------------|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `JWT_SECRET`   | Секрет для подписи JWT          |
| `PORT`         | Порт сервера (по умолчанию 3000)|
