export const courseIdPattern = /^[a-z0-9-]{1,64}$/;

export function lessonPosition(value: unknown) {
  const number = typeof value === 'string' && /^[1-9]\d{0,2}$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number >= 1 && number <= 100 ? number : null;
}

export function studyHref(id: string, lesson?: number | null) {
  const path = `/learn/${id}`;
  return lesson ? `${path}?lesson=${lesson}` : path;
}

export function courseReturnPath(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = /^\/(courses|learn)\/[a-z0-9-]{1,64}(?:\?lesson=([0-9]{1,3}))?$/.exec(value);
  if (!match || (match[2] && (match[1] !== 'learn' || lessonPosition(match[2]) === null))) return null;
  return value;
}

export function courseLogin(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}
