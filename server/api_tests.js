(async ()=>{
  const fetch = globalThis.fetch;
  const base = 'http://localhost:5000';
  async function req(path, opts={}){
    const r = await fetch(base+path, opts);
    const text = await r.text();
    let body = text;
    try { body = JSON.parse(text); } catch(e) {}
    console.log(path, r.status, body);
    return { status: r.status, body, headers: r.headers };
  }

  console.log('POST valid reservation');
  await req('/api/reservations', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({nom:'API', prenom:'Test', telephone:'+33612345678', adresse:'Addr', email:'api1@example.com'})});

  console.log('POST invalid reservation (phone/email)');
  await req('/api/reservations', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({nom:'Bad', prenom:'User', telephone:'12', adresse:'Addr', email:'bad'})});

  console.log('GET /api/reservations without auth');
  await req('/api/reservations', {method: 'GET'});

  console.log('Admin login with password ala1234');
  const login = await fetch(base+'/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password:'ala1234'})});
  console.log('/api/admin/login status', login.status);
  const setcookie = login.headers.get('set-cookie');
  const cookie = setcookie ? setcookie.split(';')[0] : null;
  console.log('cookie:', cookie);

  console.log('GET /api/reservations with admin cookie');
  const list = await fetch(base + '/api/reservations', {method:'GET', headers: cookie ? {cookie} : {}});
  console.log('/api/reservations auth status', list.status);
  const listText = await list.text();
  console.log('list body (truncated):', listText.slice(0,400));

  let firstId = null;
  try { const rows = JSON.parse(listText); if (rows && rows.length) firstId = rows[0].id; } catch(e){}
  if (firstId) {
    console.log('PUT update statut for id', firstId);
    const put = await fetch(base + `/api/admin/reservations/${firstId}`, {method:'PUT', headers: {'Content-Type':'application/json', cookie}, body: JSON.stringify({statut:'confirmé'})});
    console.log('PUT status', put.status, await put.text());
  }

  console.log('GET /api/admin/export (CSV)');
  const exp = await fetch(base + '/api/admin/export', {method:'GET', headers: cookie ? {cookie} : {}});
  console.log('/api/admin/export status', exp.status);
  const expText = await exp.text();
  console.log('CSV preview:', expText.slice(0,200));

  console.log('API tests complete');
})();
