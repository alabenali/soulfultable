const mysql = require('mysql2');
const opts = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  port: Number(process.env.MYSQL_PORT || 3306),
  connectTimeout: 10000,
  enableKeepAlive: true,
  ssl: false
};
console.log('connect options', opts);
const conn = mysql.createConnection(opts);
conn.on('error', (e) => console.log('conn error', e && e.code, e && e.message));
conn.on('connect', () => console.log('socket connected'));
conn.on('end', () => console.log('socket end'));
conn.on('close', () => console.log('socket close'));
conn.on('timeout', () => console.log('socket timeout'));
conn.on('drain', () => console.log('socket drain'));

conn.connect((err) => {
  if (err) {
    console.error('connect cb err', err && err.code, err && err.message);
    conn.destroy();
    return;
  }
  conn.query('SELECT VERSION() AS v', (er, rows) => {
    if (er) console.error('query err', er);
    else console.log('version', rows[0].v);
    conn.end();
  });
});
