import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { publicSupabase } from './public-supabase';

export function clientAddress(headers: Headers, onRender = process.env.RENDER === 'true') {
  // Only trust the header behind Render's documented edge proxy. Local callers cannot spoof it.
  const ip = onRender ? headers.get('x-forwarded-for')?.split(',')[0].trim() : 'local';
  return ip && isIP(ip) ? ip : 'local';
}
export function limitKey(value: string) { return createHash('sha256').update(value).digest('hex'); }
export async function authLimit(action: string, headers: Headers, identity?: string) {
  const client = publicSupabase();
  for (const [scope,key] of [[`${action}_ip`,clientAddress(headers)], ...(identity ? [[`${action}_identity`,identity.toLowerCase()]] : [])]) {
    const {data,error} = await client.rpc('consume_auth_limit', {p_scope:scope,p_key:limitKey(key)});
    if (error || typeof data?.allowed !== 'boolean') throw new Error('LIMIT_UNAVAILABLE');
    if (!data.allowed) return Number(data.retry_after) || 60;
  }
  return 0;
}
