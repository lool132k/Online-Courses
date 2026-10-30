export type AuthAction = 'signup' | 'login' | 'resend';
export function validateAuth(action: AuthAction, body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const errors: Record<string, string> = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Укажите корректный email.';
  if (action !== 'resend' && (password.length < 12 || password.length > 128)) errors.password = 'Пароль должен содержать от 12 до 128 символов.';
  if (action === 'signup' && (name.length < 2 || name.length > 80)) errors.name = 'Имя должно содержать от 2 до 80 символов.';
  return { email, password, name, errors };
}

export function trustedOrigin(origin: string | null, configuredUrl: string) {
  try { return origin !== null && origin === new URL(configuredUrl).origin; }
  catch { return false; }
}
