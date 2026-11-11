'use client';
import { useState, type FormEvent } from 'react';

export type Profile = { email: string; name: string; is_teacher: boolean; is_admin: boolean; request: null | { status: string; reason: string | null } };
type Section = 'personal' | 'security' | 'teacher' | 'logout';
type Props = {
  profile: Profile; name: string; nameError: string; message: string; busy: boolean;
  onNameChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onTeacher: () => void; onLogout: () => void;
};
const sections: { id: Section; title: string; description: string; icon: string }[] = [
  { id:'personal', title:'Личные данные', description:'Имя и адрес почты', icon:'01' },
  { id:'security', title:'Безопасность', description:'Вход и защита аккаунта', icon:'02' },
  { id:'teacher', title:'Стать преподавателем', description:'Заявка и её статус', icon:'03' },
  { id:'logout', title:'Выход', description:'Завершить сеанс', icon:'↗' },
];

export function AccountDashboard({profile,name,nameError,message,busy,onNameChange,onSave,onTeacher,onLogout}: Props) {
  const [section,setSection] = useState<Section>('personal');
  const role = profile.is_admin ? 'Администратор' : profile.is_teacher ? 'Преподаватель' : 'Студент';
  return <section className="account-page">
    <div className="account-heading"><div><p className="eyebrow">ТВОЁ ПРОСТРАНСТВО</p><h1>Личный кабинет</h1><p className="muted">Управляй профилем и возвращайся к новым знаниям.</p></div><a className="button secondary" href="/demo/index.html">В каталог ↗</a></div>
    <div className="account-grid">
      <aside className="account-sidebar">
        <div className="account-identity"><span className="account-avatar" aria-hidden="true">{profile.name.trim().slice(0,1).toUpperCase()}</span><div><strong>{profile.name}</strong><span className="account-role">{role}</span></div></div>
        <nav className="account-menu" aria-label="Разделы личного кабинета">{sections.map(item=><button key={item.id} type="button" aria-pressed={section===item.id} aria-controls="account-content" disabled={busy} className={`account-menu-item ${section===item.id?'is-active':''} ${item.id==='logout'?'account-menu-exit':''}`} onClick={()=>setSection(item.id)}><span className="account-menu-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</nav>
      </aside>
      <div className="account-content" id="account-content">
        <p role="status" aria-live="polite" className="account-feedback">{message}</p>
        {section==='personal' && <section aria-labelledby="personal-title"><p className="eyebrow">ПРОФИЛЬ</p><h2 id="personal-title">Личные данные</h2><p className="muted">Так тебя будут видеть на BMBCourses.</p><form onSubmit={onSave}><label>Имя<input name="name" autoComplete="name" value={name} onChange={event=>onNameChange(event.target.value)} minLength={2} maxLength={80} required disabled={busy} aria-invalid={Boolean(nameError)} aria-describedby="profile-name-error"/><span className="error" id="profile-name-error">{nameError}</span></label><dl className="account-details"><div><dt>Email</dt><dd>{profile.email}<span className="verified-badge">Подтверждён</span></dd></div><div><dt>Права на платформе</dt><dd>{role}</dd></div></dl><button disabled={busy || name.trim()===profile.name}>{busy?'Сохраняем…':'Сохранить изменения'}</button></form></section>}
        {section==='security' && <section aria-labelledby="security-title"><p className="eyebrow">ЗАЩИТА АККАУНТА</p><h2 id="security-title">Безопасность</h2><p className="muted">Информация о входе и подтверждении твоего аккаунта.</p><dl className="account-details"><div><dt>Адрес для входа</dt><dd>{profile.email}</dd></div><div><dt>Подтверждение почты</dt><dd><span className="verified-badge">Email подтверждён</span></dd></div><div><dt>Способ входа</dt><dd>Email и пароль</dd></div></dl><div className="account-tip"><strong>Береги доступ к аккаунту</strong><p>Используй уникальный пароль и не передавай другим ссылки подтверждения. На чужом устройстве заверши сеанс в разделе «Выход».</p></div></section>}
        {section==='teacher' && <section aria-labelledby="teacher-title"><p className="eyebrow">ДЕЛИСЬ ЗНАНИЯМИ</p><h2 id="teacher-title">Стать преподавателем</h2><p className="muted">Хочешь создавать свои курсы? Подай заявку — администратор рассмотрит её и откроет доступ преподавателя.</p><div className="account-tip"><strong>{profile.is_teacher?'Ты уже преподаватель':profile.request ? 'Твоя заявка' : 'Начни с заявки'}</strong><p>{profile.is_teacher?'Права преподавателя уже доступны в твоём аккаунте.':profile.request ? ({pending:'Заявка на рассмотрении. Повторно отправлять её не нужно.',approved:'Заявка одобрена.',rejected:'Заявка отклонена. Ты можешь подать новую заявку.'} as Record<string,string>)[profile.request.status] : 'Отправь заявку одним нажатием. До одобрения у тебя сохраняются права студента.'}</p>{profile.request?.reason && <p>Комментарий администратора: {profile.request.reason}</p>}</div><button disabled={busy || profile.is_teacher || profile.request?.status==='pending'} onClick={onTeacher}>{profile.is_teacher?'Доступ открыт':profile.request?.status==='pending'?'На рассмотрении':'Отправить заявку'}</button></section>}
        {section==='logout' && <section aria-labelledby="logout-title"><p className="eyebrow">ТЕКУЩИЙ СЕАНС</p><h2 id="logout-title">Выйти из аккаунта</h2><p className="muted">Сеанс в этом браузере будет завершён. Чтобы снова открыть личный кабинет, потребуется войти.</p><div className="account-tip"><strong>{profile.email}</strong><p>Данные профиля сохранятся. Прогресс демонстрационных курсов останется в этом браузере.</p></div><button className="danger-button" disabled={busy} onClick={onLogout}>{busy?'Выходим…':'Выйти из аккаунта'}</button></section>}
      </div>
    </div>
  </section>;
}
