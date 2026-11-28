'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function ResetForm(){
  const query=useSearchParams();
  const [message,setMessage]=useState(query.has('error')?'Ссылка недействительна. Запросите новую.':'');
  const [busy,setBusy]=useState(false),[done,setDone]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;setBusy(true);setMessage('');
    try {const response=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const result=await response.json();setMessage(result.message);if(response.ok){setDone(true);form.reset();}}
    catch {setMessage('Нет связи с сервером. Попробуйте позже.');}finally{setBusy(false);}
  }
  return <section className="panel"><p className="eyebrow">БЕЗОПАСНОСТЬ</p><h1>Новый пароль</h1><p className="muted">Придумай уникальный пароль. После сохранения потребуется снова войти в аккаунт.</p>{!done&&!query.has('error')&&<form onSubmit={submit}><label>Новый пароль<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label><label>Повтори пароль<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label><button disabled={busy}>{busy?'Сохраняем…':'Сохранить пароль'}</button></form>}<p role="status" aria-live="polite">{message}</p><div className="actions"><a href="/auth">Войти</a><a href="/auth?mode=recover">Запросить новую ссылку</a></div></section>;
}
