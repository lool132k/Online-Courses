'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AuthAction } from '../../lib/auth-validation';
export function AuthForm() {
  const query = useSearchParams();
  const [mode, setMode] = useState<AuthAction>(query.get('mode') === 'signup' ? 'signup' : 'login');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(query.has('confirmed') ? 'Email подтверждён. Войдите с вашим паролем.' : query.has('error') ? 'Ссылка недействительна или истекла. Запросите новое письмо.' : '');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setErrors({}); setMessage('');
    const form = event.currentTarget;
    try {
      const values = Object.fromEntries(new FormData(form));
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      setErrors(result.errors || {}); setMessage(result.message || 'Не удалось выполнить запрос.');
      if (response.ok && mode === 'login') window.location.assign('/account');
      if (response.ok) form.reset();
    } catch { setMessage('Нет связи с сервером. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  return <section className="panel"><p className="eyebrow">ЛИЧНЫЙ АККАУНТ</p><h1>{mode === 'signup' ? 'Начнём учиться' : mode === 'resend' ? 'Подтвердить email' : 'С возвращением'}</h1><div className="tabs">{([['login','Вход'],['signup','Регистрация'],['resend','Повторить письмо']] as const).map(([value,label])=><button className={mode===value?'selected':'secondary'} disabled={busy} key={value} onClick={()=>{setMode(value);setErrors({});setMessage('');}}>{label}</button>)}</div><form onSubmit={submit}>
    {mode === 'signup' && <label>Имя<input name="name" autoComplete="name" minLength={2} maxLength={80} required aria-invalid={Boolean(errors.name)} aria-describedby="name-error"/><span className="error" id="name-error">{errors.name}</span></label>}
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby="email-error"/><span className="error" id="email-error">{errors.email}</span></label>
    {mode !== 'resend' && <label>Пароль<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required aria-invalid={Boolean(errors.password)} aria-describedby="password-error"/><small>От 12 до 128 символов</small><span className="error" id="password-error">{errors.password}</span></label>}
    <p role="status" aria-live="polite">{message}</p><button disabled={busy}>{busy ? 'Подождите…' : mode === 'signup' ? 'Создать аккаунт' : mode === 'resend' ? 'Отправить письмо' : 'Войти'}</button>
  </form><p className="muted">После регистрации подтвердите email по ссылке в письме. Новый аккаунт получает права студента.</p></section>;
}
