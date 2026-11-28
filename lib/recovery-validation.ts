export const recoveryCookie = 'bmb-recovery-ticket';
export function validRecoveryToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,256}$/.test(value);
}
export function validateNewPassword(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Некорректные данные.';
  const data = body as Record<string,unknown>;
  if (Object.keys(data).some(key=>!['password','confirmation'].includes(key))) return 'Некорректные данные.';
  if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) return 'Пароль должен содержать от 12 до 128 символов.';
  if (data.password !== data.confirmation) return 'Пароли не совпадают.';
  return null;
}
