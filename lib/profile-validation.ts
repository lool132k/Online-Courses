// The API accepts one editable field. Roles and user IDs are never client input.
export function validateProfile(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { name: '', error: 'Некорректные данные профиля.' };
  }
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== 'name')) {
    return { name: '', error: 'Можно изменить только имя.' };
  }
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    return { name, error: 'Имя должно содержать от 2 до 80 символов.' };
  }
  return { name, error: null };
}
