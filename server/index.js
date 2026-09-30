require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { promisify } = require('util');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    // Allow localhost and 127.0.0.1 on any port during development
    try {
      const allowedHost = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (allowedHost) return callback(null, true);
    } catch (e) {
      // fallthrough
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' } // secure in production
}));

if (!process.env.ADMIN_PASSWORD) {
  console.warn('Warning: ADMIN_PASSWORD is not set. Admin login will always fail until configured. See server/.env.example');
}

// Database setup: support SQLite (default) or MySQL (if MYSQL_HOST or DB_CLIENT=mysql)
let dbType = 'sqlite';
let db; // sqlite db handle
let pool; // mysql pool
let dbRun, dbAll, dbGet;

const useMysql = process.env.DB_CLIENT === 'mysql' || !!process.env.MYSQL_HOST;
if (useMysql) {
  const mysql = require('mysql2/promise');
  dbType = 'mysql';
  (async () => {
    try {
      // Try to create pool with provided database; if DB doesn't exist, create it
      const config = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'soulful_table',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
      };
      try {
        pool = mysql.createPool(config);
        await pool.query('SELECT 1');
      } catch (err) {
        // If database doesn't exist, create it then recreate pool
        if (err && /Unknown database/.test(String(err))) {
          const adminPool = await mysql.createPool({
            host: config.host,
            user: config.user,
            password: config.password,
            waitForConnections: true,
            connectionLimit: 2
          });
          await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          await adminPool.end();
          pool = mysql.createPool(config);
        } else {
          throw err;
        }
      }

      // Create table if not exists
      const createTableMySQL = `
        CREATE TABLE IF NOT EXISTS reservations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          prenom VARCHAR(255) NOT NULL,
          telephone VARCHAR(64) NOT NULL,
          adresse VARCHAR(512) NOT NULL,
          email VARCHAR(255) NOT NULL,
          payment_method VARCHAR(255) DEFAULT 'vente_physique',
          date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          statut VARCHAR(50) DEFAULT 'en attente',
          email_envoye TINYINT(1) DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;
      await pool.query(createTableMySQL);
      // Try to add column if it does not exist (safe on newer MySQL, ignore errors otherwise)
      try {
        await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255) DEFAULT 'vente_physique'");
      } catch (e) {
        // ignore if not supported / already exists
      }
      console.log('MySQL reservations table ready');

      dbRun = async (sql, params = []) => {
        const [result] = await pool.execute(sql, params);
        return { lastID: result.insertId, changes: result.affectedRows };
      };

      dbAll = async (sql, params = []) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
      };

      dbGet = async (sql, params = []) => {
        const [rows] = await pool.execute(sql, params);
        return rows[0] || null;
      };
    } catch (err) {
      console.error('MySQL initialization error:', err);
      process.exit(1);
    }
  })();
} else {
  // SQLite default
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'reservations.db');
  db = new sqlite3.Database(dbPath);

  // Initialize reservations table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT NOT NULL,
      adresse TEXT NOT NULL,
      email TEXT NOT NULL,
      payment_method TEXT DEFAULT 'vente_physique',
      date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
      statut TEXT DEFAULT 'en attente',
      email_envoye BOOLEAN DEFAULT 0
    )
  `;
  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Reservations table ready');
    }
  });

  // Helper to run queries as promises (sqlite3 uses `this` in callbacks)
  dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  // Ensure payment_method column exists for older DBs
  db.get("PRAGMA table_info(reservations)", [], (err, info) => {
    // run a safe ALTER TABLE to add column; if it already exists SQLite will error which we ignore
    db.run("ALTER TABLE reservations ADD COLUMN payment_method TEXT DEFAULT 'vente_physique'", (alterErr) => {
      // ignore alter errors (most likely column exists)
    });
  });

  dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

  dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Email transporter setup (configure via .env)
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Middleware to require admin authentication
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ message: 'Non autorisé' });
};

// POST /api/reservations - create a new reservation
app.post('/api/reservations', async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse, email, payment } = req.body;

    // Basic validation
    if (!nom || !prenom || !telephone || !adresse || !email) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Server-side format validation
    const phoneRegex = /^\+?[\d\s]{8,}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!phoneRegex.test(telephone)) {
      return res.status(400).json({ message: 'Format téléphone invalide' });
    }
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format email invalide' });
    }

    // Validate payment method
    const allowedPayments = ['vente_physique', 'transfert_bancaire', 'paiement_jour'];
    const paymentMethod = allowedPayments.includes(payment) ? payment : 'vente_physique';

    const insertQuery = `
      INSERT INTO reservations (nom, prenom, telephone, adresse, email, payment_method)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await dbRun(insertQuery, [nom, prenom, telephone, adresse, email, paymentMethod]);
    const reservationId = result.lastID;

    // Send confirmation email if transporter is configured
    let emailSent = false;
    if (transporter) {
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"Soulful Table" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Confirmation de votre réservation - Soulful Table',
        html: `
          <h2>Bonjour ${prenom} ${nom},</h2>
          <p>Merci pour votre réservation à Soulful Table !</p>
          <p>Nous vous avons bien enregistré avec les informations suivantes :</p>
          <ul>
            <li>Nom : ${nom}</li>
            <li>Prénom : ${prenom}</li>
            <li>Téléphone : ${telephone}</li>
            <li>Adresse : ${adresse}</li>
            <li>Email : ${email}</li>
          </ul>
          <p>Vous recevrez bientôt les détails de l'événement.</p>
          <p>À très bientôt,</p>
          <p>L'équipe Soulful Table</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        emailSent = true;
        // Update email_envoye flag
        await dbRun(
          'UPDATE reservations SET email_envoye = 1 WHERE id = ?',
          [reservationId]
        );
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Keep email_envoye as 0 (default)
      }
    }

    // Fetch the created reservation to return
    const newReservation = await dbGet(
      'SELECT * FROM reservations WHERE id = ?',
      [reservationId]
    );

    res.status(201).json({
      message: 'Réservation enregistrée avec succès',
      reservation: newReservation
    });
  } catch (error) {
    console.error('Error processing reservation:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/reservations - protected: admin only
app.get('/api/reservations', requireAdmin, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM reservations ORDER BY date_inscription DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Admin routes
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'Mot de passe requis' });
  }

  const checkPlainPassword = () => {
    if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.json({ success: true, message: 'Connexion réussie' });
    }
    return res.status(401).json({ message: 'Mot de passe incorrect' });
  };

  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (adminHash) {
    bcrypt.compare(password, adminHash, (err, same) => {
      if (err) return res.status(500).json({ message: 'Erreur serveur' });
      if (same) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: 'Connexion réussie' });
      }
      return checkPlainPassword();
    });
    return;
  }
  return checkPlainPassword();
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Impossible de se déconnecter' });
    }
    res.clearCookie('connect.sid'); // clear session cookie
    res.json({ success: true, message: 'Déconnexion réussie' });
  });
});

app.get('/api/admin/reservations', requireAdmin, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM reservations ORDER BY date_inscription DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.put('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  if (!statut) {
    return res.status(400).json({ message: 'Statut requis' });
  }
  const allowedStatuts = ['en attente', 'confirmé', 'annulé'];
  if (!allowedStatuts.includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }
  try {
    const result = await dbRun('UPDATE reservations SET statut = ? WHERE id = ?', [statut, id]);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.get('/api/admin/export', requireAdmin, async (req, res) => {
  // Set headers for CSV download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');

  // Create CSV stream
  // Add UTF-8 BOM to help Excel display accents correctly
  const csvHeader = ['ID', 'Nom', 'Prénom', 'Téléphone', 'Adresse', 'Email', 'Mode paiement', 'Date d\'inscription', 'Statut', 'Email envoyé'];
  res.write('\uFEFF' + csvHeader.join(',') + '\n');

  try {
    const rows = await dbAll('SELECT * FROM reservations ORDER BY date_inscription DESC');
    for (const row of rows) {
      const csvRow = [
        row.id,
        `"${row.nom}"`,
        `"${row.prenom}"`,
        `"${row.telephone}"`,
        `"${row.adresse}"`,
        `"${row.email}"`,
        `"${row.payment_method || ''}"`,
        `"${row.date_inscription}"`,
        `"${row.statut}"`,
        row.email_envoye ? 'Oui' : 'Non'
      ].join(',');
      res.write(csvRow + '\n');
    }
    res.end();
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Serve static frontend assets from client/dist if available
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Public config endpoint (RIB for bank transfers)
app.get('/api/config', (req, res) => {
  const rib = process.env.RIB || 'RIB non configuré. Contactez l\'organisateur.';
  res.json({ rib });
});

// Serve frontend app or fallback API status
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint non trouvé' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({
    status: 'online',
    message: 'Soulful Table Backend API Server is running',
    endpoints: {
      config: '/api/config',
      reservations: '/api/reservations',
      adminLogin: '/api/admin/login'
    }
  });
});