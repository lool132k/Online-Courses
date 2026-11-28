'use client';
import { useState } from 'react';
export function SecurityActions(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function signOutAll(){
    setBusy(true);setMessage('');
    try {const response=await fetch('/api/auth/logout-all',{method:'POST'});const data=await response.json();if(response.ok)window.location.assign('/demo/index.html');else setMessage(data.message);}
    catch {setMessage('Не удалось завершить сеансы. Попробуйте позже.');}finally{setBusy(false);}
  }
  return <><div className="account-tip"><strong>Пароль и устройства</strong><p>Смени пароль по одноразовой ссылке на почту. Сеанс действует не более 7 дней; после выхода сервер закрывает доступ к профилю.</p></div><div className="actions"><a className="button" href="/auth?mode=recover">Сменить пароль</a><button className="secondary" disabled={busy} onClick={signOutAll}>{busy?'Завершаем сеансы…':'Выйти на всех устройствах'}</button></div><p role="status" aria-live="polite">{message}</p></>;
}
