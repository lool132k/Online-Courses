# Развёртывание на Render

Сервис: Node.js Web Service на тарифе Free; база и Auth — в существующем Supabase.

- Node.js: `.node-version`.
- Build: `npm ci && npm run build` (prebuild копирует HTML-каталог в public/demo).
- Start: `npm start -- --hostname 0.0.0.0 --port $PORT`.
- Health check: `/`.
- Переменные Render: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL` (точный HTTPS origin сервиса без завершающего слеша).
- В Supabase Authentication / URL Configuration: Site URL = APP_URL; разрешить APP_URL + `/auth/confirm`. Старые localhost redirect URLs можно сохранить для разработки.
- `.env.local`, сервисные ключи, скриншоты и файлы презентации в ветку развёртывания не включаются.

Каталог: `/demo/index.html`, вход: `/auth`, кабинет: `/account`.

Free-сервис засыпает после 15 минут без входящих запросов; первый запрос ожидает запуска. SMTP-ограничения Supabase сохраняются до настройки собственного провайдера. Данные хранятся в Supabase; локальная файловая система Render для них не используется.

Источники: https://render.com/docs/deploy-nextjs-app, https://render.com/docs/node-version, https://render.com/docs/free.
