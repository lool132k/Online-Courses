import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/demo', { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'account.js']) await copyFile(`dist/${file}`, `public/demo/${file}`);
