import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '../../../lib/supabase';
import { trustedOrigin } from '../../../lib/auth-validation';
import { validateProfile } from '../../../lib/profile-validation';
export const dynamic = 'force-dynamic';
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity() {
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return null;
  const { data: profile, error: profileError } = await client.from('profiles').select('name,is_teacher,is_admin,blocked').eq('id',user.id).single();
  if (profileError) throw new Error('PROFILE_UNAVAILABLE');
  if (!profile || profile.blocked) return null;
  return { client, user, profile };
}
export async function GET() {
  if (!configured()) return reply({ message: 'Личный кабинет пока недоступен. Попробуйте позже.' },503);
  try {
    const session = await identity();
    if (!session) return reply({ message: 'Войдите с подтверждённым email.' },401);
    const { data, error } = await session.client.from('teacher_requests').select('id,status,reason,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(1);
    if (error) throw error;
    return reply({ email: session.user.email, ...session.profile, request: data?.[0] || null });
  } catch { return reply({ message: 'Не удалось загрузить профиль. Попробуйте позже.' },503); }
}
export async function POST(request: NextRequest) {
  if (!configured()) return reply({ message: 'Подключение ещё не настроено.' },503);
  if (!trustedOrigin(request.headers.get('origin'),process.env.APP_URL!)) return reply({ message: 'Источник запроса не разрешён.' },403);
  try {
    const session = await identity();
    if (!session) return reply({ message: 'Необходим подтверждённый аккаунт.' },401);
    if (session.profile.is_teacher) return reply({ message: 'У вас уже есть права преподавателя.' },409);
    const { error } = await session.client.from('teacher_requests').insert({ user_id: session.user.id });
    if (error) return reply({ message: error.code === '23505' ? 'Заявка уже ожидает рассмотрения.' : 'Не удалось отправить заявку.' }, error.code === '23505' ? 409 : 400);
    return reply({ message: 'Заявка отправлена администратору.' },201);
  } catch { return reply({ message: 'Сервис временно недоступен.' },503); }
}

export async function PATCH(request: NextRequest) {
  if (!configured()) return reply({ message: 'Подключение ещё не настроено.' },503);
  if (!trustedOrigin(request.headers.get('origin'),process.env.APP_URL!)) return reply({ message: 'Источник запроса не разрешён.' },403);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ message: 'Слишком большой запрос.' },413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ message: 'Некорректный JSON.' },400); }
    const { name, error: validationError } = validateProfile(body);
    if (validationError) return reply({ message: validationError, errors: { name: validationError } },400);
    const session = await identity();
    if (!session) return reply({ message: 'Необходим подтверждённый аккаунт.' },401);
    const { data, error } = await session.client.from('profiles').update({ name }).eq('id',session.user.id).select('name').single();
    if (error || !data) return reply({ message: 'Не удалось сохранить имя. Попробуйте позже.' },503);
    return reply({ message: 'Имя сохранено.', name: data.name });
  } catch { return reply({ message: 'Не удалось сохранить профиль. Попробуйте позже.' },503); }
}
