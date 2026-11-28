# Развёртывание на Render

Сервис: Node.js Web Service на тарифе Free; база и Auth — в существующем Supabase.

- Node.js: `.node-version`.
- Build: `npm ci && npm run build` (prebuild копирует HTML-каталог в public/demo).
- Start: `npm start -- --hostname 0.0.0.0 --port $PORT`.
- Health check: `/`.
- Переменные Render: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL` (точный HTTPS origin сервиса без завершающего слеша).
- В Supabase Authentication / URL Configuration: Site URL = APP_URL; разрешить APP_URL + `/auth/confirm`. Старые localhost redirect URLs можно сохранить для разработки.
- `.env.local`, сервисные ключи, скриншоты и файлы презентации в ветку развёртывания не включаются.

Каталог: `/courses`, вход: `/auth`, кабинет: `/account`.

## Переход с версии от 20 ноября

1. В Supabase применить по порядку `202611240001_learning.sql`, `202611240002_course_studio.sql`, `202611260001_learning_results.sql` и `202611260002_python_quiz.sql`.
2. Развернуть ветку `codex/render-deploy` на Render и убедиться, что `/courses/python` показывает программу с квизом, а `/api/learning/results` доступен только после входа.
3. Применить `202611260003_retire_legacy_lessons.sql`. После этого тексты уроков доступны через учебный API с проверкой записи, а гостевой каталог показывает программу.

Free-сервис засыпает после 15 минут без входящих запросов; первый запрос ожидает запуска. SMTP-ограничения Supabase сохраняются до настройки собственного провайдера. Данные хранятся в Supabase; локальная файловая система Render для них не используется.

Источники: https://render.com/docs/deploy-nextjs-app, https://render.com/docs/node-version, https://render.com/docs/free.
