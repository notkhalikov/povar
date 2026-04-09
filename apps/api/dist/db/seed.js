import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { users, chefProfiles } from './schema.js';
const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);
// ─── Seed data ────────────────────────────────────────────────────────────────
const CHEFS = [
    {
        user: {
            telegramId: 1000001,
            name: 'Нино Беридзе',
            city: 'Тбилиси',
            lang: 'ru',
        },
        profile: {
            bio: 'Готовлю грузинскую кухню уже 12 лет. Специализируюсь на хинкали, хачапури и мясных блюдах на мангале. Приеду к вам домой или привезу готовое.',
            cuisineTags: ['Грузинская', 'Домашняя'],
            workFormats: ['home_visit', 'delivery'],
            districts: ['Ваке', 'Сабуртало', 'Мтацминда'],
            avgPrice: '120',
            ratingCache: '4.9',
            ordersCount: 47,
        },
    },
    {
        user: {
            telegramId: 1000002,
            name: 'Тамара Кварацхелия',
            city: 'Тбилиси',
            lang: 'ru',
        },
        profile: {
            bio: 'Домашняя аджарская кухня — моя страсть. Готовлю аджарские хачапури, пхали и свежие салаты. Только натуральные продукты с рынка Дезертирка.',
            cuisineTags: ['Аджарская', 'Грузинская', 'Вегетарианская'],
            workFormats: ['delivery'],
            districts: ['Исани', 'Самгори', 'Надзаладеви'],
            avgPrice: '80',
            ratingCache: '4.7',
            ordersCount: 31,
        },
    },
    {
        user: {
            telegramId: 1000003,
            name: 'Давит Чикованани',
            city: 'Тбилиси',
            lang: 'ru',
        },
        profile: {
            bio: 'Профессиональный повар с 8-летним опытом в ресторанах. Готовлю европейскую и грузинскую кухню для ужинов и мероприятий у вас дома.',
            cuisineTags: ['Европейская', 'Грузинская', 'Fusion'],
            workFormats: ['home_visit'],
            districts: ['Ваке', 'Вера', 'Мтацминда'],
            avgPrice: '200',
            ratingCache: '4.8',
            ordersCount: 22,
        },
    },
    {
        user: {
            telegramId: 1000004,
            name: 'Лали Гоголашвили',
            city: 'Тбилиси',
            lang: 'ka',
        },
        profile: {
            bio: 'Пеку торты и готовлю десерты на заказ. Также делаю полноценные обеды из мегрельской кухни — гебжалия, эларджи, мегрули хачапури.',
            cuisineTags: ['Мегрельская', 'Грузинская', 'Десерты'],
            workFormats: ['delivery'],
            districts: ['Глдани', 'Дидубе', 'Чугурети'],
            avgPrice: '70',
            ratingCache: '4.6',
            ordersCount: 58,
        },
    },
    {
        user: {
            telegramId: 1000005,
            name: 'Зураб Элиава',
            city: 'Батуми',
            lang: 'ru',
        },
        profile: {
            bio: 'Морепродукты и рыба — мой конёк. Живу в Батуми всю жизнь, знаю лучших поставщиков. Готовлю у вас дома или доставляю свежеприготовленное.',
            cuisineTags: ['Морепродукты', 'Рыбная', 'Аджарская'],
            workFormats: ['home_visit', 'delivery'],
            districts: ['Центр', 'Старый город', 'Химшиашвили'],
            avgPrice: '150',
            ratingCache: '4.9',
            ordersCount: 35,
        },
    },
    {
        user: {
            telegramId: 1000006,
            name: 'Манана Хурцидзе',
            city: 'Батуми',
            lang: 'ru',
        },
        profile: {
            bio: 'Готовлю домашнюю еду с любовью. Лобиани, харчо, сациви — всё как у бабушки. Доставка по всему Батуми.',
            cuisineTags: ['Грузинская', 'Домашняя'],
            workFormats: ['delivery'],
            districts: ['Центр', 'Новый бульвар', 'Руставели'],
            avgPrice: '65',
            ratingCache: '4.5',
            ordersCount: 74,
        },
    },
    {
        user: {
            telegramId: 1000007,
            name: 'Анна Попова',
            city: 'Тбилиси',
            lang: 'ru',
        },
        profile: {
            bio: 'Русская и европейская кухня для русскоязычного комьюнити в Тбилиси. Борщ, пельмени, котлеты — всё что напоминает дом.',
            cuisineTags: ['Русская', 'Европейская', 'Домашняя'],
            workFormats: ['delivery', 'home_visit'],
            districts: ['Сабуртало', 'Дидгори', 'Ортачала'],
            avgPrice: '90',
            ratingCache: '4.7',
            ordersCount: 29,
        },
    },
    {
        user: {
            telegramId: 1000008,
            name: 'Гиорги Табатадзе',
            city: 'Батуми',
            lang: 'ka',
        },
        profile: {
            bio: 'Специализируюсь на барбекю и блюдах на огне. Привезу всё оборудование, закуплю мясо и приготовлю у вас. Идеально для вечеринок.',
            cuisineTags: ['BBQ', 'Мясная', 'Грузинская'],
            workFormats: ['home_visit'],
            districts: ['Центр', 'Старый город', 'Аэропорт'],
            avgPrice: '250',
            ratingCache: '5.0',
            ordersCount: 18,
        },
    },
];
// ─── Run ──────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('Seeding database…');
    let created = 0;
    let skipped = 0;
    for (const { user: userData, profile } of CHEFS) {
        // Idempotent: skip if user already exists
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.telegramId, userData.telegramId))
            .limit(1);
        if (existing[0]) {
            skipped++;
            continue;
        }
        const [user] = await db
            .insert(users)
            .values({ ...userData, role: 'chef' })
            .returning({ id: users.id });
        await db.insert(chefProfiles).values({
            userId: user.id,
            bio: profile.bio,
            cuisineTags: profile.cuisineTags,
            workFormats: profile.workFormats,
            districts: profile.districts,
            avgPrice: profile.avgPrice,
            ratingCache: profile.ratingCache,
            ordersCount: profile.ordersCount,
            verificationStatus: 'approved',
            isActive: true,
        });
        created++;
    }
    console.log(`Done: ${created} created, ${skipped} skipped`);
}
seed()
    .catch(console.error)
    .finally(() => sql.end());
//# sourceMappingURL=seed.js.map