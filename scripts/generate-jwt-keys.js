const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    publicKey: publicKey.replace(/\n/g, '\\n'),
    privateKey: privateKey.replace(/\n/g, '\\n'),
  };
}

function main() {
  console.log('Generating JWT Access Key Pair...');
  const accessKeys = generateKeyPair();

  console.log('Generating JWT Refresh Key Pair...');
  const refreshKeys = generateKeyPair();

  const envContent = `
# RS256 JWT Keys
JWT_ACCESS_PRIVATE_KEY="${accessKeys.privateKey}"
JWT_ACCESS_PUBLIC_KEY="${accessKeys.publicKey}"
JWT_REFRESH_PRIVATE_KEY="${refreshKeys.privateKey}"
JWT_REFRESH_PUBLIC_KEY="${refreshKeys.publicKey}"
`;

  const envFilePath = path.join(__dirname, '..', '.env.development');

  let currentEnv = '';
  if (fs.existsSync(envFilePath)) {
    currentEnv = fs.readFileSync(envFilePath, 'utf8');
  }

  // Remove old keys if they exist (simple replacement for this script)
  const cleanedEnv = currentEnv
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('JWT_ACCESS_PRIVATE_KEY=') &&
        !line.startsWith('JWT_ACCESS_PUBLIC_KEY=') &&
        !line.startsWith('JWT_REFRESH_PRIVATE_KEY=') &&
        !line.startsWith('JWT_REFRESH_PUBLIC_KEY=') &&
        line !== '# RS256 JWT Keys',
    )
    .join('\n');

  const finalEnv = cleanedEnv.trim() + '\n' + envContent;

  fs.writeFileSync(envFilePath, finalEnv, 'utf8');
  console.log(`Successfully generated and appended JWT keys to ${envFilePath}`);
}

main();
