(() => {
  const $ = (id) => document.getElementById(id);

  let accessToken = null;
  let refreshToken = null;

  const setTokens = (a, r) => {
    accessToken = a || accessToken;
    refreshToken = r || refreshToken;
    $("accessTokenShort").textContent = accessToken ? accessToken.slice(0, 16) + '…' : '(vide)';
    $("refreshTokenShort").textContent = refreshToken ? refreshToken.slice(0, 16) + '…' : '(vide)';
  };

  const getBase = () => $("apiBase").value.replace(/\/$/, '');

  const out = (id, data) => {
    const el = $(id);
    el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  };

  async function api(path, { method = 'GET', body, withAuth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await fetch(`${getBase()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text || '{}'); } catch { json = { raw: text }; }
    if (!res.ok) throw Object.assign(new Error(json.message || 'HTTP Error'), { status: res.status, body: json });
    return json;
  }

  $("btnRegister").addEventListener('click', async () => {
    try {
      const name = $("regName").value;
      const email = $("regEmail").value;
      const password = $("regPwd").value;
      const role = $("regRole").value || undefined;
      const data = await api('/auth/register', { method: 'POST', body: { name, email, password, role } });
      out('outRegister', data);
    } catch (e) {
      out('outRegister', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnLogin").addEventListener('click', async () => {
    try {
      const email = $("loginEmail").value;
      const password = $("loginPwd").value;
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      setTokens(data.accessToken, data.refreshToken);
      out('outLogin', data);
    } catch (e) {
      out('outLogin', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnRefresh").addEventListener('click', async () => {
    try {
      const data = await api('/auth/refresh', { method: 'POST', body: { refreshToken } });
      setTokens(data.accessToken, data.refreshToken);
      out('outTokens', data);
    } catch (e) {
      out('outTokens', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnLogout").addEventListener('click', async () => {
    try {
      const data = await api('/auth/logout', { method: 'POST', body: { refreshToken } });
      setTokens(null, null);
      out('outTokens', data);
    } catch (e) {
      out('outTokens', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnProfile").addEventListener('click', async () => {
    try {
      const data = await api('/profile', { method: 'GET', withAuth: true });
      out('outProfile', data);
    } catch (e) {
      out('outProfile', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnAdmin").addEventListener('click', async () => {
    try {
      const data = await api('/admin', { method: 'GET', withAuth: true });
      out('outAdmin', data);
    } catch (e) {
      out('outAdmin', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnUsers").addEventListener('click', async () => {
    try {
      const data = await api('/users', { method: 'GET', withAuth: true });
      out('outUsers', data);
    } catch (e) {
      out('outUsers', { error: true, message: e.message, details: e.body });
    }
  });
})();
