const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const dbFile = 'reservations.db';
if (!fs.existsSync(dbFile)) {
  console.error('DB_NOT_FOUND');
  process.exit(1);
}
const db = new sqlite3.Database(dbFile);
db.all('SELECT id,nom,prenom,telephone,adresse,email,date_inscription,statut,email_envoye FROM reservations ORDER BY id', [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const header = 'ID,Nom,Prénom,Téléphone,Adresse,Email,Date d\'inscription,Statut,Email_envoye';
  const lines = rows.map(r => [
    r.id,
    `"${(r.nom||'').replace(/"/g,'""') }"`,
    `"${(r.prenom||'').replace(/"/g,'""') }"`,
    `"${(r.telephone||'').replace(/"/g,'""') }"`,
    `"${(r.adresse||'').replace(/"/g,'""') }"`,
    `"${(r.email||'').replace(/"/g,'""') }"`,
    `"${r.date_inscription || ''}"`,
    `"${r.statut || ''}"`,
    r.email_envoye ? 1 : 0
  ].join(','));
  const csv = [header].concat(lines).join('\n');
  fs.writeFileSync('reservations_export.csv', '\uFEFF' + csv, 'utf8');
  console.log('reservations_export.csv créé — lignes:', rows.length);
  db.close();
});
