import { NextRequest, NextResponse } from 'next/server';
import { recoveryCookie, validRecoveryToken } from '../../../lib/recovery-validation';

// Do not verify/consume on GET: mail scanners may follow links. The password POST verifies it.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token_hash');
  const valid = validRecoveryToken(token) && request.nextUrl.searchParams.get('type') === 'recovery';
  const response = NextResponse.redirect(new URL(valid?'/auth/reset':'/auth/reset?error=link', process.env.APP_URL || request.url));
  response.headers.set('Cache-Control','no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  response.cookies.set(recoveryCookie,valid?token!:'',{httpOnly:true,secure:new URL(process.env.APP_URL || request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:valid?600:0});
  return response;
}
