const bcrypt = require('bcrypt');
const readline = require('readline');

const QUESTION = 'Mot de passe admin : ';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Hide typed characters (show * instead)
rl._writeToOutput = (str) => {
  if (str === QUESTION) rl.output.write(str);
  else if (str.includes('\b')) rl.output.write('\b \b');
  else if (str.includes('\n') || str.includes('\r')) rl.output.write('\n');
  else rl.output.write('*');
};

rl.question(QUESTION, (password) => {
  if (!password || password.trim() === '') {
    console.error('Erreur : mot de passe vide.');
    rl.close();
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 12);
  console.log('\nAjoutez cette ligne dans server/.env :');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  rl.close();
});
