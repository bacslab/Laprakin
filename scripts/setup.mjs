import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envExample = path.join(root, 'server', '.env.example');
const envFile = path.join(root, 'server', '.env');

if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log('✔ server/.env dibuat dari server/.env.example');
} else if (fs.existsSync(envFile)) {
  console.log('ℹ server/.env sudah ada, tidak ditimpa.');
} else {
  console.log('⚠ server/.env.example tidak ditemukan.');
}

console.log('');
console.log('Langkah berikutnya:');
console.log('1. npm install');
console.log('2. npm run dev');
console.log('3. Buka http://localhost:5173');
console.log('');
console.log('Jika npm masih mengambil registry yang salah, jalankan:');
console.log('npm config set registry https://registry.npmjs.org/');
