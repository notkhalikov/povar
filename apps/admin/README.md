# @povar/admin — Admin Panel

Веб-интерфейс для управления маркетплейсом. React + Vite, порт 5174.

## Запуск

```bash
npm install
npm run dev   # http://localhost:5174
```

## Структура

```
src/
  main.tsx         # точка входа
  App.tsx          # корневой компонент + роутер
  pages/           # страницы: Dashboard, Cooks, Orders, Dishes, Users
  components/      # переиспользуемые компоненты таблиц, форм, модалок
  api/             # fetch-обёртки для apps/api (admin-эндпоинты)
  types/           # TypeScript-типы
```

## Авторизация

Доступ только для администраторов. Аутентификация через JWT, выдаётся отдельным эндпоинтом `/api/admin/auth`.
