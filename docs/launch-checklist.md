# Launch Checklist

Пройди все пункты перед запуском первых реальных пользователей.

---

## Безопасность

- [ ] `JWT_SECRET` длиннее 32 символов в проде (используй `openssl rand -hex 32`)
- [ ] `WEBHOOK_SECRET` установлен и совпадает в API (`apps/api/.env`) и боте (`apps/bot/.env`)
- [ ] `BOT_TOKEN` тестового бота **не используется** в проде — взят токен продакшен-бота из BotFather
- [ ] `DATABASE_URL` указывает на Railway (не `localhost`)
- [ ] CORS настроен только на домен Vercel (не wildcard `*`) — `CORS_ORIGIN=https://povar-one.vercel.app` или `NODE_ENV=production`
- [ ] Все `.env` файлы добавлены в `.gitignore` (проверить `git status`)

---

## Функциональность

- [ ] Telegram Payments в боевом режиме: `PAYMENTS_TOKEN` — не тестовый токен (`_TEST_`)
- [ ] Хотя бы один повар с `verificationStatus = 'approved'` и `isActive = true` в БД
- [ ] Запущен `seed-production.ts` для создания admin-пользователя: `npx tsx src/db/seed-production.ts <your_telegram_id>`
- [ ] Бот зарегистрирован в BotFather с правильным mini app URL (`/newapp` или `/editapp`)
- [ ] Mini app URL в BotFather указывает на Vercel домен (`https://povar-one.vercel.app`)
- [ ] API задеплоен и отвечает на `/health`: `curl https://<api-domain>/health`
- [ ] `/metrics` endpoint доступен для Railway health check

---

## Контент

- [ ] Текст `/start` сообщения бота финальный (не "Добро пожаловать, тест!")
- [ ] Все тестовые seed-данные удалены из продакшен БД (пользователи с `telegramId 1000001–2000002`)
- [ ] Meta description и Open Graph теги актуальны в `apps/web/index.html`

---

## Перед каждым деплоем

- [ ] `npm run build` проходит без ошибок во всех воркспейсах
- [ ] `npm run typecheck` без ошибок
- [ ] Миграции применены: `npm run db:migrate` (в `apps/api`)
- [ ] Переменные окружения обновлены на Railway / Vercel
