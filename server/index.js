require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 5000;

// Fail fast if critical configuration is missing (no fallback secret in code)
if (!process.env.ADMIN_PASSWORD_HASH) {
  console.error('FATAL: ADMIN_PASSWORD_HASH manquant. Générez-en un avec `npm run hash-password` puis ajoutez-le dans server/.env');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET manquant. Ajoutez-le dans server/.env');
  process.exit(1);
}

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS: exact whitelist read from CORS_ORIGINS (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // requires HTTPS in production
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 heures
  }
}));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

const reservationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  limit: 5,
  message: { message: 'Trop de demandes de réservation. Réessayez dans une heure.' }
});

// Escape HTML entities (used in email body)
const esc = (value) => String(value)
  .replace(/&/g, '&' + 'amp;')
  .replace(/</g, '&' + 'lt;')
  .replace(/>/g, '&' + 'gt;')
  .replace(/"/g, '&' + 'quot;')
  .replace(/'/g, '&' + '#39;');

// Normalize a Tunisian phone number to +216XXXXXXXX (returns null if invalid)
function normalizeTunisianPhone(raw) {
  const digits = String(raw).replace(/[\s.\-()]/g, '').replace(/^\+/, '');
  let national = null;
  if (/^00216\d{8}$/.test(digits)) national = digits.slice(5);
  else if (/^216\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^\d{8}$/.test(digits)) national = digits;
  if (!national) return null;
  return `+216${national}`;
}

// Reservation validation schema
const reservationSchema = z.object({
  nom: z.string({ required_error: 'Nom requis' }).trim().min(1, 'Nom requis').max(100, 'Nom trop long (100 caractères maximum)'),
  prenom: z.string({ required_error: 'Prénom requis' }).trim().min(1, 'Prénom requis').max(100, 'Prénom trop long (100 caractères maximum)'),
  telephone: z.string({ required_error: 'Téléphone requis' }).trim().transform(normalizeTunisianPhone).refine((v) => v !== null, { message: 'Numéro de téléphone invalide (format tunisien attendu)' }),
  adresse: z.string({ required_error: 'Adresse requise' }).trim().min(1, 'Adresse requise').max(255, 'Adresse trop longue (255 caractères maximum)'),
  email: z.string({ required_error: 'Email requis' }).trim().toLowerCase().max(254, 'Email trop long (254 caractères maximum)').email('Format email invalide'),
  payment: z.string().optional(),
  website: z.string().optional() // honeypot: must stay empty
});

// Database setup: support SQLite (default) or MySQL (if MYSQL_HOST or DB_CLIENT=mysql)
let dbType = 'sqlite';
let db; // sqlite db handle
let pool; // mysql pool
let dbRun, dbAll, dbGet;

const requestedMysql = process.env.DB_CLIENT === 'mysql' || (!!process.env.MYSQL_HOST && process.env.MYSQL_HOST !== 'disabled');
let useMysql = requestedMysql;

async function initDatabase() {
  if (useMysql) {
    const mysql = require('mysql2/promise');
    dbType = 'mysql';
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
      // Try to create pool with provided database; if DB doesn't exist, create it
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

      // Compatible with MySQL AND MariaDB: check column existence instead of ADD COLUMN IF NOT EXISTS
      const [columns] = await pool.query("SHOW COLUMNS FROM reservations LIKE 'payment_method'");
      if (columns.length === 0) {
        await pool.query("ALTER TABLE reservations ADD COLUMN payment_method VARCHAR(255) DEFAULT 'vente_physique'");
      }

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

      console.log('MySQL reservations table ready');
    } catch (err) {
      console.warn('MySQL requested but unavailable. Falling back to SQLite for local development.', err.message || err);
      useMysql = false;
      dbType = 'sqlite';
    }
  }

  if (!useMysql) {
    // SQLite default (sqlite3 is loaded only when used)
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'reservations.db');
    db = new sqlite3.Database(dbPath);

    // Helper to run queries as promises (sqlite3 uses `this` in callbacks)
    dbRun = (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
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

    // Create table (awaited before the server starts)
    await new Promise((resolve, reject) => {
      db.run(`
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
      `, (err) => (err ? reject(err) : resolve()));
    });

    // Ensure payment_method column exists for older DBs (check first, then alter)
    const columns = await dbAll('PRAGMA table_info(reservations)');
    if (!columns.some((c) => c.name === 'payment_method')) {
      await dbRun("ALTER TABLE reservations ADD COLUMN payment_method TEXT DEFAULT 'vente_physique'");
    }

    console.log('Reservations table ready');
  }
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
app.post('/api/reservations', reservationLimiter, async (req, res) => {
  try {
    const parsed = reservationSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return res.status(400).json({ message: firstError ? firstError.message : 'Données invalides' });
    }
    const { nom, prenom, telephone, adresse, email, payment, website } = parsed.data;

    // Honeypot: hidden field that must stay empty (bots fill it) - fake success, no insert
    if (website && website.trim() !== '') {
      return res.status(201).json({
        message: 'Réservation enregistrée avec succès',
        reservation: { nom, prenom, telephone, adresse, email, payment_method: payment },
        emailSent: false
      });
    }

    // Validate payment method
    const allowedPayments = ['vente_physique', 'transfert_bancaire', 'paiement_jour'];
    const paymentMethod = allowedPayments.includes(payment) ? payment : 'vente_physique';

    // Refuse duplicate emails with a clear message
    const existing = await dbGet('SELECT id FROM reservations WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ message: 'Une réservation a déjà été enregistrée avec cet email.' });
    }

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
          <h2>Bonjour ${esc(prenom)} ${esc(nom)},</h2>
          <p>Merci pour votre réservation à Soulful Table !</p>
          <p>Nous vous avons bien enregistré avec les informations suivantes :</p>
          <ul>
            <li>Nom : ${esc(nom)}</li>
            <li>Prénom : ${esc(prenom)}</li>
            <li>Téléphone : ${esc(telephone)}</li>
            <li>Adresse : ${esc(adresse)}</li>
            <li>Email : ${esc(email)}</li>
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
      reservation: newReservation,
      emailSent
    });
  } catch (error) {
    console.error('Error processing reservation:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Admin routes
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Mot de passe requis' });
  }

  // Only bcrypt comparison against ADMIN_PASSWORD_HASH (no plain password fallback)
  bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH, (err, same) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    if (!same) return res.status(401).json({ message: 'Mot de passe incorrect' });

    // Regenerate the session to prevent session fixation
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ message: 'Erreur serveur' });
      req.session.isAdmin = true;
      return res.json({ success: true, message: 'Connexion réussie' });
    });
  });
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
  const { statut } = req.body || {};
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

// CSV export: build the whole content BEFORE sending headers (avoids ERR_HTTP_HEADERS_SENT)
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // CSV injection guard: prefix an apostrophe to dangerous leading characters
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Escape quotes
  return '"' + s.replace(/"/g, '""') + '"';
}

app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM reservations ORDER BY date_inscription DESC');
    const header = ['ID', 'Nom', 'Prénom', 'Téléphone', 'Adresse', 'Email', 'Mode paiement', "Date d'inscription", 'Statut', 'Email envoyé'];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) {
      lines.push([
        row.id,
        row.nom,
        row.prenom,
        row.telephone,
        row.adresse,
        row.email,
        row.payment_method || '',
        row.date_inscription,
        row.statut,
        row.email_envoye ? 'Oui' : 'Non'
      ].map(csvCell).join(','));
    }
    // UTF-8 BOM to help Excel display accents correctly
    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
    res.send(csv);
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
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
      adminReservations: '/api/admin/reservations',
      adminLogin: '/api/admin/login'
    }
  });
});

// Start the server only once the database is ready
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization error:', err);
    process.exit(1);
  });