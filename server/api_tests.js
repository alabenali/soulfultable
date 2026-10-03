(async () => {
  const fetch = globalThis.fetch;
  const base = process.env.TEST_BASE_URL || 'http://localhost:5000';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD; // plain password matching ADMIN_PASSWORD_HASH
  let failures = 0;

  function expectStatus(label, actual, expected) {
    const accepted = Array.isArray(expected) ? expected : [expected];
    if (!accepted.includes(actual)) {
      failures += 1;
      console.error(`FAIL ${label}: expected ${accepted.join(' or ')}, received ${actual}`);
    }
  }

  async function req(path, opts = {}) {
    const r = await fetch(base + path, opts);
    const text = await r.text();
    let body = text;
    try { body = JSON.parse(text); } catch (e) {}
    console.log(path, r.status, body);
    return { status: r.status, body, headers: r.headers };
  }

  console.log('POST valid reservation');
  const validReservation = await req('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'API', prenom: 'Test', telephone: '+21612345678', adresse: 'Addr', email: 'api1@example.com' })
  });
  expectStatus('valid reservation', validReservation.status, [201, 409, 429]);

  console.log('POST invalid reservation (phone/email)');
  const invalidReservation = await req('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Bad', prenom: 'User', telephone: '12', adresse: 'Addr', email: 'bad' })
  });
  expectStatus('invalid reservation', invalidReservation.status, [400, 429]);

  console.log('GET /api/admin/reservations without auth');
  const unauthenticatedList = await req('/api/admin/reservations', { method: 'GET' });
  expectStatus('unauthenticated admin list', unauthenticatedList.status, 401);

  if (!adminPassword) {
    console.warn('TEST_ADMIN_PASSWORD non défini : tests admin ignorés.');
    if (failures) process.exitCode = 1;
    console.log('API tests complete');
    return;
  }

  console.log('Admin login with password from TEST_ADMIN_PASSWORD');
  const login = await fetch(base + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  console.log('/api/admin/login status', login.status);
  expectStatus('admin login', login.status, 200);
  const setcookie = login.headers.get('set-cookie');
  const cookie = setcookie ? setcookie.split(';')[0] : null;
  console.log('cookie:', cookie ? '(reçu)' : '(absent)');

  console.log('GET /api/admin/reservations with admin cookie');
  const list = await fetch(base + '/api/admin/reservations', { method: 'GET', headers: cookie ? { cookie } : {} });
  console.log('/api/admin/reservations auth status', list.status);
  expectStatus('authenticated admin list', list.status, 200);
  const listText = await list.text();
  console.log('list body (truncated):', listText.slice(0, 400));

  let firstId = null;
  try { const rows = JSON.parse(listText); if (rows && rows.length) firstId = rows[0].id; } catch (e) {}
  if (firstId) {
    console.log('PUT update statut for id', firstId);
    const put = await fetch(base + `/api/admin/reservations/${firstId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ statut: 'confirmé' })
    });
    console.log('PUT status', put.status, await put.text());
    expectStatus('admin status update', put.status, 200);
  }

  console.log('GET /api/admin/export (CSV)');
  const exp = await fetch(base + '/api/admin/export', { method: 'GET', headers: cookie ? { cookie } : {} });
  console.log('/api/admin/export status', exp.status);
  expectStatus('admin CSV export', exp.status, 200);
  const expText = await exp.text();
  console.log('CSV preview:', expText.slice(0, 200));

  if (failures) {
    console.error(`API tests failed: ${failures} assertion(s)`);
    process.exitCode = 1;
  } else {
    console.log('API tests complete');
  }
})();
