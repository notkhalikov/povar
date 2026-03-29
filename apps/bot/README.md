# @povar/bot — Telegram Bot

Telegram-бот для маркетплейса домашних поваров. grammY + TypeScript.

## Запуск

```bash
cp .env.example .env   # вставь BOT_TOKEN от @BotFather
npm install
npm run dev
```

## Структура

```
src/
  main.ts          # точка входа, инициализация бота
  commands/        # обработчики команд (/start, /menu, /orders, …)
  scenes/          # многошаговые диалоги (регистрация повара, оформление заказа)
  keyboards/       # inline- и reply-клавиатуры
  middleware/      # auth, i18n, логирование
```

## Переменные окружения

| Переменная      | Описание                              |
|-----------------|---------------------------------------|
| `BOT_TOKEN`     | Токен бота от @BotFather              |
| `API_BASE_URL`  | URL бэкенда (apps/api)                |
