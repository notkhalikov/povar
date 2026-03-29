# Entities & Domain Model
# Domain Model & Entities

## Основные сущности

### User
- id
- telegram_id
- имя
- роль: customer | chef | support | admin
- язык
- город
- дата регистрации
- UTM: source, medium, campaign, content, term
- статус: active | banned

### ChefProfile
- id
- user_id
- био
- кухни (tags)
- форматы работы: home_visit, delivery
- районы работы
- средний чек
- статус верификации
- статус активности
- рейтинг (кеш)
- количество заказов
- портфолио (список media ids)

### Order
- id
- customer_id
- chef_id
- type: home_visit | delivery
- город, район
- адрес
- дата/время
- людей/порций
- описание/меню
- agreed_price
- status: draft | awaiting_payment | paid | in_progress | completed | dispute_pending | refunded | cancelled
- timestamps

Для home_visit:
- кто покупает продукты
- бюджет на продукты

### Payment
- id
- order_id
- amount
- currency
- provider (Telegram/локальный)
- status: created | paid | failed | refunded | partially_refunded
- provider_transaction_id
- timestamps

### Dispute
- id
- order_id
- opened_by: customer | chef
- reason_code
- description
- attachments (media ids)
- status: open | awaiting_other_party | support_review | resolved
- resolution_type: full_refund | partial_refund | no_refund
- resolution_comment
- timestamps

### Review
- id
- order_id
- author_id (customer)
- chef_id
- rating (1–5)
- tags_quality (чек‑боксы)
- text
- photo_ids
- created_at

### Request (запрос на подбор)
- id
- customer_id
- город, район
- дата/время
- формат: home_visit | delivery
- людей/порций
- описание
- бюджет
- status: open | closed
- timestamps

### ChefResponse (отклик повара)
- id
- request_id
- chef_id
- предложенная_цена
- комментарий/меню
- status: new | accepted | rejected
- timestamps
