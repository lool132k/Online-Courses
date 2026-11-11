'use client';
import { useEffect, useState } from 'react';
import { AccountDashboard, type Profile } from './dashboard';
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
    try { const r=await fetch(logout?'/api/auth/logout':'/api/account',{method:'POST'}); const data=await r.json(); if(r.ok && logout) window.location.assign('/demo/index.html'); else {if(r.ok) await load();setMessage(data.message);} }
    catch {setMessage('Нет связи с сервером. Повторите попытку.');} finally {setBusy(false);}
  }
  if (!profile) return <section className="panel"><p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1>Ваш аккаунт</h1><p role="status">{message}</p><div className="actions"><a className="button" href="/auth">Войти или зарегистрироваться</a><button className="secondary" onClick={load}>Повторить загрузку</button></div></section>;
  return <AccountDashboard profile={profile} name={name} nameError={nameError} message={message} busy={busy} onNameChange={value=>{setName(value);setNameError('');}} onSave={saveName} onTeacher={()=>action(false)} onLogout={()=>action(true)}/>;
}
