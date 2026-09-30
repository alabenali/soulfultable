require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

(async () => {
  try {
    const sqlitePath = path.join(__dirname, 'reservations.db');
    const sdb = new sqlite3.Database(sqlitePath);
    const allRows = await new Promise((resolve, reject) => {
      sdb.all('SELECT * FROM reservations ORDER BY date_inscription ASC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
    sdb.close();

    const host = process.env.MYSQL_HOST || '127.0.0.1';
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'soulful_table';

    // Connect and create DB if needed
    let pool;
    try {
      pool = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4' });
      await pool.query('SELECT 1');
    } catch (err) {
      if (err && /Unknown database/.test(String(err))) {
        const admin = await mysql.createPool({ host, user, password, waitForConnections: true, connectionLimit: 2 });
        await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await admin.end();
        pool = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4' });
      } else {
        throw err;
      }
    }

    // Create table
    const createTableMySQL = `
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        prenom VARCHAR(255) NOT NULL,
        telephone VARCHAR(64) NOT NULL,
        adresse VARCHAR(512) NOT NULL,
        email VARCHAR(255) NOT NULL,
        date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        statut VARCHAR(50) DEFAULT 'en attente',
        email_envoye TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createTableMySQL);

    // Insert rows
    let inserted = 0;
    for (const row of allRows) {
      const sql = `INSERT INTO reservations (nom, prenom, telephone, adresse, email, date_inscription, statut, email_envoye) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [row.nom, row.prenom, row.telephone, row.adresse, row.email, row.date_inscription, row.statut || 'en attente', row.email_envoye ? 1 : 0];
      await pool.execute(sql, params);
      inserted++;
    }

    await pool.end();
    console.log(`Migration complète. Lignes migrées : ${inserted}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
