import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '../../../../lib/supabase';
import { trustedOrigin, validateAuth, type AuthAction } from '../../../../lib/auth-validation';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!configured()) return reply({ message: 'Регистрация и вход пока недоступны. Попробуйте позже.' }, 503);
  if (!trustedOrigin(request.headers.get('origin'), process.env.APP_URL!)) return reply({ message: 'Источник запроса не разрешён.' }, 403);
  const { action } = await context.params;
  if (!['signup','login','resend','logout'].includes(action)) return reply({ message: 'Неизвестное действие.' }, 404);
  try {
    const client = await supabase();
    if (action === 'logout') {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) return reply({ message: 'Не удалось завершить сессию. Повторите запрос.' }, 502);
      return reply({ message: 'Вы вышли из аккаунта.' });
    }
    const raw = await request.text();
    if (raw.length > 4096) return reply({ message: 'Слишком большой запрос.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ message: 'Некорректный JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ message: 'Некорректные данные.' }, 400);
    const { email, password, name, errors } = validateAuth(action as AuthAction, body);
    if (Object.keys(errors).length) return reply({ message: 'Проверьте поля формы.', errors }, 400);
    const emailRedirectTo = new URL('/auth/confirm', process.env.APP_URL!).href;
    if (action === 'signup') {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo } });
      // A project with confirmation disabled must not grant immediate access.
      if (data.session) { await client.auth.signOut({ scope: 'local' }); return reply({ message: 'Администратору необходимо включить подтверждение email в Supabase.' }, 503); }
      if (error) return reply({ message: error.status === 429 ? 'Слишком много запросов. Попробуйте позже.' : 'Не удалось отправить письмо. Проверьте данные или попробуйте позже.' }, error.status === 429 ? 429 : 400);
      return reply({ message: 'Если адрес доступен для регистрации, на него отправлено письмо. Проверьте почту и подтвердите email.' });
    }
    if (action === 'resend') {
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
      if (error?.status === 429) return reply({ message: 'Подождите перед повторной отправкой.' }, 429);
      if (error && (error.status ?? 500) >= 500) return reply({ message: 'Сервис писем временно недоступен.' }, 502);
      return reply({ message: 'Если адрес ожидает подтверждения, письмо будет отправлено. Проверьте папку «Спам».' });
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user?.email_confirmed_at) return reply({ message: 'Не удалось войти. Проверьте email, пароль и подтверждение адреса.' }, 401);
    return reply({ message: 'Вход выполнен.' });
  } catch { return reply({ message: 'Сервис временно недоступен. Попробуйте позже.' }, 503); }
}
