'use client';
import { useEffect, useState } from 'react';
type Profile = { email: string; name: string; is_teacher: boolean; is_admin: boolean; request: null | { status: string; reason: string | null } };
export default function Account() {
  const [profile,setProfile] = useState<Profile | null>(null);
  const [message,setMessage] = useState('Загружаем профиль…');
  const [busy,setBusy] = useState(false);
  const [name,setName] = useState('');
  const [nameError,setNameError] = useState('');
  async function load() {
    try { const r=await fetch('/api/account',{cache:'no-store'}); const data=await r.json(); if(r.ok){setProfile(data);setName(data.name);setMessage('');}else{setProfile(null);setMessage(data.message);} }
    catch { setMessage('Не удалось связаться с сервером.'); }
  }
  useEffect(()=>{void load();},[]);
  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNameError(''); setMessage('');
    try {
      const response = await fetch('/api/account', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
      const data = await response.json();
      if (response.ok) {
        setProfile(previous => previous ? {...previous,name:data.name} : previous);
        setName(data.name);
      } else { setNameError(data.errors?.name || ''); }
      setMessage(data.message || 'Не удалось сохранить имя.');
    } catch { setMessage('Нет связи с сервером. Имя не сохранено.'); }
    finally { setBusy(false); }
  }
  async function action(logout: boolean) {
    setBusy(true);
    try { const r=await fetch(logout?'/api/auth/logout':'/api/account',{method:'POST'}); const data=await r.json(); if(r.ok && logout) window.location.assign('/auth'); else {if(r.ok) await load();setMessage(data.message);} }
    catch {setMessage('Нет связи с сервером. Повторите попытку.');} finally {setBusy(false);}
  }
  return <section className="panel"><p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1>{profile ? `Привет, ${profile.name}` : 'Ваш аккаунт'}</h1><p role="status">{message}</p>{profile ? <><p>{profile.email} · Email подтверждён</p><p>Права: студент{profile.is_teacher?', преподаватель':''}{profile.is_admin?', администратор':''}</p>
    <form onSubmit={saveName}>
      <h2>Настройки профиля</h2>
      <label>Имя<input name="name" autoComplete="name" value={name} onChange={event=>{setName(event.target.value);setNameError('');}} minLength={2} maxLength={80} required disabled={busy} aria-invalid={Boolean(nameError)} aria-describedby="profile-name-error"/><span className="error" id="profile-name-error">{nameError}</span></label>
      <button disabled={busy || name.trim()===profile.name}>{busy ? 'Подождите…' : 'Сохранить имя'}</button>
    </form>
    <div className="notice"><h2>Хочешь делиться знаниями?</h2><p>Подай заявку преподавателя. Доступ открывается после рассмотрения администратором.</p>{profile.request && <p>Последняя заявка: {({pending:'На рассмотрении',approved:'Одобрена',rejected:'Отклонена'} as Record<string,string>)[profile.request.status]}{profile.request.reason ? ` — ${profile.request.reason}`:''}</p>}<button disabled={busy || profile.is_teacher || profile.request?.status==='pending'} onClick={()=>action(false)}>Стать преподавателем</button></div><p><a href="/demo/index.html">Перейти к демонстрационным курсам →</a></p><button className="secondary" disabled={busy} onClick={()=>action(true)}>Выйти</button></> : <div className="actions"><a className="button" href="/auth">Войти или зарегистрироваться</a><button className="secondary" onClick={load}>Повторить загрузку</button></div>}</section>;
}
