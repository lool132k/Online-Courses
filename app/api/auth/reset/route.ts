import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { trustedOrigin } from '../../../../lib/auth-validation';
import { authLimit } from '../../../../lib/auth-limits';
import { publicSupabase } from '../../../../lib/public-supabase';
import { recoveryCookie, validRecoveryToken, validateNewPassword } from '../../../../lib/recovery-validation';

export async function POST(request: NextRequest) {
  const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if (!trustedOrigin(request.headers.get('origin'),process.env.APP_URL!)) return reply({message:'Источник запроса не разрешён.'},403);
  try {
    const raw=await request.text();
    if (raw.length>4096) return reply({message:'Слишком большой запрос.'},413);
    let body;
    try {body=JSON.parse(raw);} catch {return reply({message:'Некорректный JSON.'},400);}
    const validation=validateNewPassword(body);
    if (validation) return reply({message:validation},400);
    const jar=await cookies();
    const ticket=jar.get(recoveryCookie)?.value;
    if (!validRecoveryToken(ticket)) return reply({message:'Откройте свежую ссылку восстановления из письма.'},401);
    const retry=await authLimit('reset',request.headers,ticket);
    if (retry) return NextResponse.json({message:'Слишком много попыток. Попробуйте позже.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(retry)}});
    // A normal login cookie cannot authorize password recovery. Only a valid recovery token can.
    const client=publicSupabase();
    const {data,error}=await client.auth.verifyOtp({token_hash:ticket,type:'recovery'});
    jar.set(recoveryCookie,'',{path:'/',maxAge:0,httpOnly:true,secure:new URL(process.env.APP_URL!).protocol==='https:',sameSite:'lax'});
    if (error || !data.user?.email_confirmed_at) return reply({message:'Ссылка истекла или уже использована. Запросите новую.'},401);
    try {
      const {data:active,error:checkError}=await client.rpc('session_is_active');
      if (checkError || !active) return reply({message:'Этот аккаунт недоступен.'},403);
      const {error:updateError}=await client.auth.updateUser({password:body.password});
      if (updateError) return reply({message:'Не удалось сохранить пароль. Используйте новый пароль от 12 символов и запросите свежую ссылку.'},400);
      const {error:logoutError}=await client.auth.signOut({scope:'global'});
      if (logoutError) return reply({message:'Пароль изменён. Не удалось завершить все сеансы: войдите и повторите выход со всех устройств.'});
      return reply({message:'Пароль изменён. Все сеансы завершены. Войдите с новым паролем.'});
    } finally {await client.auth.signOut({scope:'local'});}
  } catch {return reply({message:'Сервис временно недоступен. Запросите новую ссылку и попробуйте позже.'},503);}
}
