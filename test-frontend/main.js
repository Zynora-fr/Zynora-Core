(() => {
  const $ = (id) => document.getElementById(id);

  let accessToken = null;
  let refreshToken = null;
  let currentUser = null;

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

  function renderMenu() {
    const menu = $("menu");
    if (!menu) return;
    const perms = (currentUser && Array.isArray(currentUser.permissions)) ? currentUser.permissions : [];
    [...menu.querySelectorAll('[data-perm]')].forEach(li => {
      const p = li.getAttribute('data-perm');
      li.style.display = perms.includes(p) ? '' : 'none';
    });
  }

  $("btnRegister").addEventListener('click', async () => {
    try {
      const name = $("regName").value;
      const firstName = $("regFirst").value;
      const lastName = $("regLast").value;
      const username = $("regUser").value;
      const email = $("regEmail").value;
      const phone = $("regPhone").value || undefined;
      const password = $("regPwd").value;
      const role = $("regRole").value || undefined;
      const data = await api('/auth/register', { method: 'POST', body: { name, firstName, lastName, username, phone, email, password, role } });
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
      currentUser = data.user;
      renderMenu();
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
      currentUser = data.user || currentUser;
      renderMenu();
      out('outProfile', data);
    } catch (e) {
      out('outProfile', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnToggleMenu").addEventListener('click', () => {
    const el = $("menu");
    el.style.display = (el.style.display === 'none' ? '' : 'none');
  });

  // Catalogue de permissions
  $("btnListCatalog").addEventListener('click', async () => {
    try {
      const data = await api('/admin/permissions', { method: 'GET', withAuth: true });
      out('outCatalog', data);
    } catch (e) {
      out('outCatalog', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnAddCatalog").addEventListener('click', async () => {
    try {
      const key = $("permKey").value.trim();
      const label = $("permLabel").value.trim();
      const description = $("permDesc").value.trim();
      const data = await api('/admin/permissions', { method: 'POST', withAuth: true, body: { key, label, description } });
      out('outCatalog', data);
    } catch (e) {
      out('outCatalog', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnDelCatalog").addEventListener('click', async () => {
    try {
      const key = $("permKey").value.trim();
      const data = await api(`/admin/permissions/${encodeURIComponent(key)}`, { method: 'DELETE', withAuth: true });
      out('outCatalog', data);
    } catch (e) {
      out('outCatalog', { error: true, message: e.message, details: e.body });
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

  $("btnGetPerms").addEventListener('click', async () => {
    try {
      const userId = $("permsUserId").value.trim();
      const data = await api(`/admin/users/${userId}/permissions`, { method: 'GET', withAuth: true });
      out('outPerms', data);
    } catch (e) {
      out('outPerms', { error: true, message: e.message, details: e.body });
    }
  });

  $("btnSetPerms").addEventListener('click', async () => {
    try {
      const userId = $("permsUserId").value.trim();
      const perms = $("permsList").value.split(',').map(s => s.trim()).filter(Boolean);
      const data = await api(`/admin/users/${userId}/permissions`, { method: 'PUT', withAuth: true, body: { permissions: perms } });
      out('outPerms', data);
    } catch (e) {
      out('outPerms', { error: true, message: e.message, details: e.body });
    }
  });
})();
