const mysql = require('mysql2/promise');
(async () => {
  const attempts = [
    { host: '127.0.0.1', port: 3306, desc: '127.0.0.1:3306' },
    { host: 'localhost', port: 3306, desc: 'localhost:3306' },
    { host: '::1', port: 3306, desc: 'IPv6 ::1:3306' },
    { socketPath: "\\\\.\\pipe\\MySQL", desc: 'named pipe \\.\\pipe\\MySQL' }
  ];
  for (const a of attempts) {
    const opts = {
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || undefined,
      connectTimeout: 5000,
      waitForConnections: true,
      connectionLimit: 2,
      ...(a.host ? { host: a.host, port: a.port } : {}),
      ...(a.socketPath ? { socketPath: a.socketPath } : {})
    };
    process.stdout.write(`Testing ${a.desc}... `);
    try {
      const pool = await mysql.createPool(opts);
      await pool.query('SELECT VERSION() as v');
      await pool.end();
      console.log('OK');
    } catch (err) {
      console.log('FAIL:', err.code || err.message);
    }
  }
})();
