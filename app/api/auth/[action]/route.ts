import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '../../../../lib/supabase';
import { trustedOrigin, validateAuth, type AuthAction } from '../../../../lib/auth-validation';
import { authLimit } from '../../../../lib/auth-limits';
import { publicSupabase } from '../../../../lib/public-supabase';
import { courseReturnPath } from '../../../../lib/course-routing';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!configured()) return reply({ message: 'Регистрация и вход пока недоступны. Попробуйте позже.' }, 503);
  if (!trustedOrigin(request.headers.get('origin'), process.env.APP_URL!)) return reply({ message: 'Источник запроса не разрешён.' }, 403);
  const { action } = await context.params;
  if (!['signup','login','resend','recover','logout','logout-all'].includes(action)) return reply({ message: 'Неизвестное действие.' }, 404);
  try {
    const client = await supabase();
    if (action === 'logout' || action === 'logout-all') {
      const { error } = await client.auth.signOut({ scope: action === 'logout-all' ? 'global' : 'local' });
      if (error) return reply({ message: 'Не удалось завершить сессию. Повторите запрос.' }, 502);
      return reply({ message: 'Вы вышли из аккаунта.' });
    }
    const raw = await request.text();
    if (raw.length > 4096) return reply({ message: 'Слишком большой запрос.' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return reply({ message: 'Некорректный JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ message: 'Некорректные данные.' }, 400);
    const { email, password, name, errors } = validateAuth(action as AuthAction, body);
    if (Object.keys(errors).length) return reply({ message: 'Проверьте поля формы.', errors }, 400);
    const retry = await authLimit(action,request.headers,email);
    if (retry) return NextResponse.json({message:'Слишком много попыток. Попробуйте позже.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(retry)}});
    if (action === 'recover') {
      const {error} = await publicSupabase().auth.resetPasswordForEmail(email, {redirectTo:new URL('/auth/recovery',process.env.APP_URL!).href});
      if (error?.status === 429) return reply({message:'Подождите перед повторной отправкой.'},429);
      if (error && (error.status ?? 500) >= 500) return reply({message:'Не удалось отправить письмо. Попробуйте позже.'},502);
      return reply({message:'Если аккаунт с этим адресом существует, мы отправили ссылку восстановления. Проверьте почту и папку «Спам».'});
    }
    const emailRedirectTo = new URL('/auth/confirm', process.env.APP_URL!).href;
    function confirmationReply(message: string) {
      const response = reply({ message });
      const returnTo = courseReturnPath(body.next);
      response.cookies.set('bmb-course-return', returnTo ?? '', {
        path: '/auth/confirm', maxAge: returnTo ? 1800 : 0, httpOnly: true, sameSite: 'lax',
        secure: new URL(process.env.APP_URL!).protocol === 'https:',
      });
      return response;
    }
    if (action === 'signup') {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo } });
      // A project with confirmation disabled must not grant immediate access.
      if (data.session) { await client.auth.signOut({ scope: 'local' }); return reply({ message: 'Администратору необходимо включить подтверждение email в Supabase.' }, 503); }
      if (error) return reply({ message: error.status === 429 ? 'Слишком много запросов. Попробуйте позже.' : 'Не удалось отправить письмо. Проверьте данные или попробуйте позже.' }, error.status === 429 ? 429 : 400);
      return confirmationReply('Если адрес доступен для регистрации, на него отправлено письмо. Проверьте почту и подтвердите email.');
    }
    if (action === 'resend') {
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
      if (error?.status === 429) return reply({ message: 'Подождите перед повторной отправкой.' }, 429);
      if (error && (error.status ?? 500) >= 500) return reply({ message: 'Сервис писем временно недоступен.' }, 502);
      return confirmationReply('Если адрес ожидает подтверждения, письмо будет отправлено. Проверьте папку «Спам».');
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user?.email_confirmed_at) return reply({ message: 'Не удалось войти. Проверьте email, пароль и подтверждение адреса.' }, 401);
    const {data:active,error:sessionError} = await client.rpc('session_is_active');
    if (sessionError || !active) { await client.auth.signOut({scope:'local'}); return reply({message:'Аккаунт или сеанс недоступен. Попробуйте войти снова.'},401); }
    return reply({ message: 'Вход выполнен.' });
  } catch { return reply({ message: 'Сервис временно недоступен. Попробуйте позже.' }, 503); }
}
