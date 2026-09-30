const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const dbFile = 'reservations.db';
if (!fs.existsSync(dbFile)) {
  console.error('DB_NOT_FOUND');
  process.exit(1);
}
const stat = fs.statSync(dbFile);
const db = new sqlite3.Database(dbFile);
const runAll = (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r)));
(async () => {
  try {
    const schema = await runAll("PRAGMA table_info('reservations')");
    const totalRow = (await runAll('SELECT COUNT(*) as c FROM reservations'))[0].c;
    const emailSentSumRow = (await runAll('SELECT SUM(email_envoye) as s FROM reservations'))[0].s || 0;
    const statutGroups = await runAll('SELECT statut, COUNT(*) as c FROM reservations GROUP BY statut');
    const recent = await runAll('SELECT id,nom,prenom,telephone,adresse,email,date_inscription,statut,email_envoye FROM reservations ORDER BY date_inscription DESC LIMIT 10');
    const dupEmails = await runAll('SELECT email, COUNT(*) as c FROM reservations GROUP BY email HAVING c>1');
    const allRows = await runAll('SELECT id,email,telephone FROM reservations');
    const invalidEmails = allRows.filter(r => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    const invalidPhones = allRows.filter(r => !/^\+?[\d\s]{8,}$/.test(r.telephone));

    const result = {
      fileSize: stat.size,
      schema,
      totalRow,
      emailSentSum: emailSentSumRow,
      statutGroups,
      recent,
      dupEmails,
      invalidEmailsCount: invalidEmails.length,
      invalidEmailsSample: invalidEmails.slice(0, 5),
      invalidPhonesCount: invalidPhones.length,
      invalidPhonesSample: invalidPhones.slice(0, 5)
    };
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERR', err.message);
  } finally {
    db.close();
  }
})();
