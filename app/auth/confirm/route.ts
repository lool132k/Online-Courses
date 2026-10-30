import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '../../../lib/supabase';
export async function GET(request: NextRequest) {
  const target = new URL('/auth?error=confirmation', process.env.APP_URL || request.url);
  const hash = request.nextUrl.searchParams.get('token_hash');
  // Only signup confirmations: recovery tokens must never enter this flow.
  if (configured() && hash && request.nextUrl.searchParams.get('type') === 'email') {
    try {
      const client = await supabase();
      const { error } = await client.auth.verifyOtp({ token_hash: hash, type: 'email' });
      if (!error) { await client.auth.signOut({ scope: 'local' }); target.search = '?confirmed=1'; }
    } catch { /* Never expose provider errors or tokens. */ }
  }
  return NextResponse.redirect(target, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
