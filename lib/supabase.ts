import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.APP_URL);
}

// Only server routes use this client. No browser SDK or localStorage tokens.
export async function supabase() {
  if (!configured()) throw new Error('AUTH_NOT_CONFIGURED');
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {
      httpOnly: true,
      secure: new URL(process.env.APP_URL!).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => { for (const { name, value, options } of items) jar.set(name, value, options); },
    },
  });
}
