import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '../../../lib/supabase';
export async function GET(request: NextRequest) {
  const target = new URL('/auth?error=confirmation', process.env.APP_URL || request.url);
  const hash = request.nextUrl.searchParams.get('token_hash');
  const code = request.nextUrl.searchParams.get('code');
  // Only signup confirmations: recovery tokens must never enter this flow.
  // Default Supabase templates use PKCE; custom SMTP templates can use token_hash.
  if (configured() && ((hash && request.nextUrl.searchParams.get('type') === 'email') ||
    (code && !hash && !request.nextUrl.searchParams.has('type')))) {
    try {
      const client = await supabase();
      const { data, error } = hash
        ? await client.auth.verifyOtp({ token_hash: hash, type: 'email' })
        : await client.auth.exchangeCodeForSession(code!);
      if (!error && data.user?.email_confirmed_at) {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (!signOutError) target.search = '?confirmed=1';
      }
    } catch { /* Never expose provider errors or tokens. */ }
  }
  return NextResponse.redirect(target, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
