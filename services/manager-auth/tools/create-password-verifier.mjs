// Run interactively when activating absadmin. Never logs plaintext to files.
// The password is displayed once on the controlling terminal, not stdout.
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run in an interactive terminal. Do not redirect or capture the password.');
const destination = path.resolve('.absadmin-verifier');
if (fs.existsSync(destination)) throw new Error('A verifier already exists. Rotate it explicitly instead of overwriting it.');
const password = randomBytes(30).toString('base64url');
const salt = randomBytes(16);
const digest = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
fs.writeFileSync(destination, `scrypt-v1:${salt.toString('hex')}:${digest.toString('hex')}`, { flag: 'wx', mode: 0o600 });
const terminal = fs.createWriteStream(process.platform === 'win32' ? 'CONOUT$' : '/dev/tty');
terminal.write(`\nabsadmin password (save privately):\n${password}\n\n`);
const prompt = readline.createInterface({ input: process.stdin, output: terminal });
await prompt.question('Press Enter after saving your password. ');
prompt.close();
terminal.end();
process.stdout.write('Verifier created. Configure ABSADMIN_PASSWORD_VERIFIER as a Worker secret to activate it.\n');
