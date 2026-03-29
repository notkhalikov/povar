# @povar/web — Telegram Mini App

Фронтенд маркетплейса — Telegram Mini App. React + Vite + @twa-dev/sdk.

## Запуск

```bash
npm install
npm run dev   # http://localhost:5173
```

Для тестирования внутри Telegram используй [ngrok](https://ngrok.com/) или [localtunnel](https://localtunnel.github.io/www/) и укажи HTTPS-URL в настройках бота через @BotFather → Edit Bot → Edit Menu Button.

## Структура

```
src/
  main.tsx         # точка входа, инициализация WebApp.ready()
  App.tsx          # корневой компонент + роутер
  pages/           # страницы: Home, CookProfile, Dish, Cart, OrderStatus
  components/      # переиспользуемые компоненты
  api/             # fetch-обёртки для запросов к apps/api
  hooks/           # кастомные хуки (useTelegram, useCart, …)
  types/           # TypeScript-типы
```

## Telegram WebApp

- `WebApp.ready()` вызывается при старте — обязательно.
- Для авторизации пользователь идентифицируется через `WebApp.initData` (валидируется на бэкенде).
- Тема берётся из `WebApp.themeParams` — используй CSS-переменные Telegram для нативного вида.
