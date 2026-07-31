# Product

## Vision

Kafgir (کفگیر) brings carefully prepared homemade meals to customers in Andimeshk. The brand is inspired by food made with love and in memory of mother. Suggested slogan: **کفگیر؛ غذای خونگی، با عشق**.

## Users and MVP

Customers use a Telegram Mini App to view the daily menu and order food. Admins use the Electron application to manage foods, daily menus, orders, statuses, manual orders, and reports. The initial sales model is per portion.

## Food discovery

- Every food belongs to one managed category.
- Foods can have any number of managed tags and one optional highlighted badge selected from those tags.
- Customers can browse a readable `/foods/[slug]` detail page with gallery, ingredients, portion/allergy information, menu availability, server-calculated remaining capacity, likes, favorites, and related foods.
- Category filters come from active database records rather than hard-coded UI identifiers.
- Daily price, capacity, availability, menu date, and ordering deadline remain daily-menu concerns rather than food-catalog fields.
- Likes and favorites require validated customer identity; anonymous visitors can still browse details.

Initial foods:

- زرشک‌پلو با مرغ
- قورمه‌سبزی
- ماکارونی
- قیمه
