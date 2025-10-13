# راهنمای فنی یکپارچگی پایگاه‌داده

این سند برای هماهنگی بین توسعه‌دهندگان و دستیارهای هوش مصنوعی هنگام ایجاد تغییرات در شِماهای JSON و داده‌های نمونه سیستم تحویل غذا آماده شده است. تمرکز سند بر روی ساختار جدول‌ها، روابط کلیدی و نکات اجباری در زمان اضافه/حذف فیلدها است.

## دامنه
- شامل تمام شِماهای موجود در مسیر `schemas/` و داده‌های نمونه مرتبط در `data/` است.
- هر تغییری روی اسکریپت‌های تولید یا اعتبارسنجی (`scripts/`) که به شِماها وابسته است نیز باید با این دستورالعمل مطابقت داشته باشد.

## استانداردهای نام‌گذاری و نوع داده
- نام جدول‌ها و فیلدها با حروف کوچک و خط زیرین (`snake_case`) نوشته می‌شوند.
- تمام کلیدهای اصلی (`id`) از نوع UUID و فقط خواندنی هستند. نمونه: `orders.id` و `stores.id`.‌
- فیلدهای ارجاعی به جدول‌های دیگر نیز UUID هستند و با پسوند `_id` نام‌گذاری می‌شوند (مانند `orders.store_id` یا `branches.store_id`).
- فیلدهای تاریخ به صورت رشته با فرمت RFC 3339 (`date-time`) ذخیره می‌شوند: `created_at`, `updated_at`, `deleted_at`.
- مقادیر پولی و عددی از نوع `number` با حداقل صفر هستند (مثل `orders.subtotal`, `orders.grand_total`).
- برای فیلدهای شمارشی حتماً لیست `enum` را به‌روزرسانی کنید تا از مقادیر نامعتبر جلوگیری شود (مثال: `orders.status`, `orders.payment_status`).

## فیلدهای مشترک
| فیلد | توضیح | محل استفاده |
| --- | --- | --- |
| `id` | شناسه یکتا (UUID) فقط خواندنی | تمام جدول‌های اصلی مثل `stores`, `orders`, `customers` | 
| `created_at` / `updated_at` | مهر زمانی ایجاد/آخرین بروزرسانی | اکثر شِماها از جمله `stores`, `orders`, `menus` |
| `deleted_at` | حذف نرم برای بازیابی احتمالی | جدول‌هایی که نیاز به نگهداری تاریخچه دارند (`orders`, `stores`, `items`) |

## ساختار و روابط جدول‌های کلیدی

### فروشندگان و ساختار شعبه‌ها
- **stores**: نگهدارنده موجودیت فروشنده با فیلدهای کلیدی `name`, `legal_name`, `country_id`, `commission_id`, `wallet_id`, `payout_account_id` و ارتباط با تنظیمات فروشگاه (`store_settings_id`) و رسانه‌ها (`logo_media_id`, `banner_media_id`).【F:schemas/stores.json†L1-L215】
- **branches**: هر رکورد مربوط به شعب یک فروشنده است. شامل `store_id`, `address_id`, `timezone`, `status` و پیکربندی سرویس‌دهی (مانند `fulfillment_types`).【F:schemas/branches.json†L1-L242】
- **store_settings**: تعریف SLA، ساعات کار، قوانین هزینه ارسال و تنظیمات عملیات فروشگاه. هر `stores.store_settings_id` به این جدول اشاره دارد.【F:schemas/store_settings.json†L1-L210】

### مدیریت منو و آیتم‌ها
- **menus**: ساختار منو با مشخصات `store_id`, `name`, `menu_type`, `is_active` و بازه‌های نمایش (`available_from`, `available_to`).【F:schemas/menus.json†L1-L153】
- **menu_sections**: دسته‌بندی‌های درون منو؛ شامل `menu_id`, `title`, `display_order` و وضعیت انتشار.【F:schemas/menu_sections.json†L1-L158】
- **items**: آیتم پایه‌ای غذا با فیلدهای `store_id`, `menu_section_id`, `sku`, `price`, `tax_category_id`, `is_available`. این جدول به رسانه (`primary_media_id`) و گروه‌های اصلاح‌گر متصل است.【F:schemas/items.json†L1-L286】
- **modifier_groups / options / option_values**: تعریف گزینه‌های انتخابی و قیمت افزوده برای آیتم‌ها. هنگام تغییر باید سازگاری بین `modifier_groups.items` و `options.modifier_group_id` حفظ شود.【F:schemas/modifier_groups.json†L1-L209】【F:schemas/options.json†L1-L205】

### مشتریان و حساب‌ها
- **customers**: اطلاعات هویتی شامل `first_name`, `last_name`, `email`, `phone`, `default_address_id`, `loyalty_points` و وضعیت حساب.【F:schemas/customers.json†L1-L223】
- **addresses / phones / contacts**: داده‌های ارتباطی مشتری و فروشگاه. فیلد `type` باید از مقادیر مجاز تعریف‌شده پیروی کند.【F:schemas/addresses.json†L1-L203】【F:schemas/phones.json†L1-L141】
- **wallets / wallet_transactions / wallet_payout_requests**: مدیریت کیف پول کاربران و فروشندگان. هنگام اضافه‌کردن تراکنش جدید، حتماً `wallets.balance` با منطق کسب‌وکار همگام شود.【F:schemas/wallets.json†L1-L171】【F:schemas/wallet_transactions.json†L1-L203】

### سفارش، پرداخت و ارسال
- **orders**: جدول مرکزی عملیات با فیلدهایی برای قیمت‌ها، وضعیت سفارش، روش ارسال، اشاره به مشتری و فروشگاه و تاریخچه زمانی.【F:schemas/orders.json†L1-L248】
- **order_items**: هر خط سفارش شامل `order_id`, `item_id`, `quantity`, `unit_price`, `total_price` و جزئیات گزینه‌ها.【F:schemas/order_items.json†L1-L214】
- **order_payments**: ثبت تراکنش‌های مالی هر سفارش با مقادیر `provider`, `status`, `amount`, `currency`, `captured_at`. باید با وضعیت `orders.payment_status` همگام باشد.【F:schemas/order_payments.json†L1-L192】
- **fulfillments**: پیگیری ارسال و وضعیت به‌روزرسانی (`status`, `assigned_courier_id`, `tracking_code`). هر تغییر باید با `orders.status` و رکوردهای مرتبط در `schedule_rules` هماهنگ باشد.【F:schemas/fulfillments.json†L1-L214】【F:schemas/schedule_rules.json†L1-L192】
- **commissions / payouts / settlements**: محاسبات تسویه حساب فروشنده؛ تغییر فرمول کارمزد باید در `commissions.rate_type` و `commission_rules` منعکس شود.【F:schemas/commissions.json†L1-L231】【F:schemas/settlements.json†L1-L197】

### محتوا، رسانه و ارزیابی
- **media**: مدیریت فایل‌های تصویری/ویدئویی با فیلدهای `type`, `mime_type`, `storage_path`, `metadata`. ارتباط با جداول دیگر از طریق `*_media_id` است.【F:schemas/media.json†L1-L189】
- **reviews**: امتیازات مشتریان با فیلدهای `order_id`, `rating`, `comment`, `visibility`. بروزرسانی باید وضعیت نمایش (`is_public`) را کنترل کند.【F:schemas/reviews.json†L1-L205】
- **promotions / coupons / campaigns**: قوانین تخفیف با شروط زمانی و محدودیت مخاطب. هنگام اضافه‌کردن شرط جدید، ساختار `promotion_rules` را معتبر نگه دارید.【F:schemas/promotions.json†L1-L264】

## اصول تغییر شِما
1. **هماهنگی**: قبل از هر تغییر، وابستگی بین جداول و اسکریپت‌ها را بررسی کنید. برای مثال، افزودن فیلد به `orders` ممکن است `order_items`, `fulfillments` و گزارش‌های مالی را تحت تأثیر قرار دهد.
2. **به‌روزرسانی داده‌های نمونه**: اگر فیلد اجباری جدید اضافه می‌شود، نمونه‌های موجود در `data/` باید مقدار معتبر داشته باشند؛ در غیر این صورت اعتبارسنجی شکست می‌خورد.
3. **حفظ سازگاری Enum**: هر زمان مقدار جدیدی در `enum` اضافه می‌شود، نقاط مصرف‌کننده (سرویس‌ها، اپلیکیشن‌ها) باید با مقدار جدید آشنا باشند.
4. **مدارک مهاجرت**: تغییرات شکستن سازگاری باید با توضیح مهاجرت، نسخه جدید و تاریخ انتشار در همین سند درج شود.

## فرآیند اعتبارسنجی و انتشار
1. اجرای `npm run validate:schemas` برای اطمینان از سازگاری تمام شِماها پس از تغییر.【F:package.json†L6-L11】
2. بررسی خروجی اسکریپت‌های تولید داده (`npm run generate:data`) در صورت تغییر جداولی که بر داده‌های نمونه اثر می‌گذارند.
3. مستندسازی تغییر در Pull Request شامل توضیح فیلدهای جدید/حذف‌شده، به‌روزرسانی وابستگی‌ها و تاثیر بر سرویس‌های مصرف‌کننده.
4. پس از تایید بازبین‌ها، تغییرات در شاخه اصلی ادغام شده و در صورت نیاز، نسخه جدید برچسب‌گذاری می‌شود.

## ضمیمه: چک‌لیست سریع تغییر شِما
- [ ] فیلد یا جدول جدید با ساختار نام‌گذاری و نوع داده استاندارد مطابقت دارد.
- [ ] وابستگی‌های `*_id` به‌روزرسانی شده و کلیدهای خارجی در سرویس‌های مرتبط اعمال شده است.
- [ ] داده‌های نمونه و تست‌ها مقدار معتبر جدید را شامل می‌شوند.
- [ ] اسناد مرتبط (این فایل یا فایل‌های دامنه‌ای دیگر) به‌روزرسانی شده‌اند.
- [ ] اسکریپت‌های خودکار بدون خطا اجرا می‌شوند.
