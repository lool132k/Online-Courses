// No Supabase keys or tokens in the HTML application: use our server API.
(() => {
  const byId = id => document.getElementById(id);
  const login = byId('account-login');
  const signup = byId('account-signup');
  const profile = byId('account-profile');
  const logout = byId('account-logout');
  const status = byId('account-status');
  const served = location.protocol === 'http:' || location.protocol === 'https:';
  let requestNumber = 0;
  function links(base) {
    login.href = `${base}/auth`;
    signup.href = `${base}/auth?mode=signup`;
    profile.href = `${base}/account`;
  }
  function message(value) {
    status.textContent = value;
    status.hidden = !value;
  }
  function guest() {
    login.hidden = signup.hidden = false;
    profile.hidden = logout.hidden = true;
    profile.textContent = 'Личный кабинет';
  }
  async function refresh() {
    const current = ++requestNumber;
    if (!served) {
      guest();
      message('Для входа запусти сервер и открой http://localhost:3000/demo/index.html. Демокурсы доступны и без входа.');
      return;
    }
    links('');
    try {
      const response = await fetch('/api/account', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (current !== requestNumber) return;
      if (response.status === 401) { guest(); message(''); return; }
      if (response.status === 404) {
        guest(); links('http://localhost:3000');
        message('Вход доступен в серверной версии: http://localhost:3000/demo/index.html.');
        return;
      }
      if (!response.ok) throw new Error('ACCOUNT_UNAVAILABLE');
      const data = await response.json();
      if (current !== requestNumber) return;
      if (typeof data.name !== 'string') throw new Error('INVALID_PROFILE');
      profile.textContent = `Кабинет: ${data.name}`;
      login.hidden = signup.hidden = true;
      profile.hidden = logout.hidden = false;
      message('');
    } catch {
      if (current !== requestNumber) return;
      guest();
      message('Не удалось проверить аккаунт. Вход и кабинет можно открыть по ссылкам; демокурсы доступны.');
    }
  }
  logout.addEventListener('click', async () => {
    ++requestNumber;
    logout.disabled = true;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('LOGOUT_FAILED');
      guest();
      message('Вы вышли из аккаунта. Прогресс демокурсов остаётся в этом браузере.');
    } catch { message('Не удалось выйти. Попробуй ещё раз или открой личный кабинет.'); }
    finally { logout.disabled = false; }
  });
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
})();
