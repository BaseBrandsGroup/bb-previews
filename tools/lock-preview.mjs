#!/usr/bin/env node
// Locks a client preview behind a password and writes it to <slug>/index.html.
// Adapted from bb-reports/tools/lock-report.mjs.
//
// Usage:
//   node tools/lock-preview.mjs <slug> <path-to-page.html> ["Client name"] ["subtitle"]
//
// Passwords and salts live OUTSIDE this repo, in ../bb-previews-private/previews.json:
//   { "rb-reclaim-launch": { "name": "Recalibrated Bodies", "subtitle": "campaign hub", "password": "...", "salt": "<hex>" } }
// A slug with no entry gets a new password and salt generated and saved there.
//
// The report is encrypted with AES-256-GCM using a key derived from the password
// (PBKDF2-SHA256, 600k rounds). What gets published is unreadable without the password.
// The salt stays fixed per client so "remember me on this device" keeps working week to week.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITERATIONS = 600000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateFile = resolve(repoRoot, '..', 'bb-previews-private', 'previews.json');

const [slug, reportPath, nameArg, subArg] = process.argv.slice(2);
if (!slug || !reportPath || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: node tools/lock-preview.mjs <slug> <page.html> ["Client name"] ["subtitle"]  (slug: lowercase, digits, dashes)');
  process.exit(1);
}

const clients = existsSync(privateFile) ? JSON.parse(readFileSync(privateFile, 'utf8')) : {};
let client = clients[slug];
if (!client) {
  const words = ['amber', 'birch', 'cobalt', 'delta', 'ember', 'falcon', 'granite', 'harbour', 'indigo', 'juniper',
    'kestrel', 'lantern', 'meadow', 'nimbus', 'orchid', 'pebble', 'quarry', 'raven', 'summit', 'timber',
    'upland', 'velvet', 'willow', 'zephyr', 'copper', 'thistle', 'marble', 'saffron', 'beacon', 'canyon'];
  const pick = () => words[randomBytes(1)[0] % words.length];
  client = { name: nameArg || slug, subtitle: subArg || 'private preview', password: `${pick()}-${pick()}-${100 + (randomBytes(2).readUInt16BE() % 900)}`, salt: randomBytes(16).toString('hex') };
  clients[slug] = client;
  mkdirSync(dirname(privateFile), { recursive: true });
  writeFileSync(privateFile, JSON.stringify(clients, null, 2) + '\n');
  console.log(`New password created for ${slug} and saved to ${privateFile}`);
}

const plain = readFileSync(reportPath);
const salt = Buffer.from(client.salt, 'hex');
const key = pbkdf2Sync(client.password, salt, ITERATIONS, 32, 'sha256');
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

const payload = JSON.stringify({ s: salt.toString('base64'), i: iv.toString('base64'), d: data.toString('base64'), n: ITERATIONS });
const title = String(client.name).replace(/[<>&"]/g, '');
const subtitle = String(client.subtitle || 'private preview').replace(/[<>&"]/g, '');
const logo = 'data:image/png;base64,' + readFileSync(join(repoRoot, 'assets', 'bb-logo-navy.png')).toString('base64');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} | ${subtitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  @font-face { font-family:'Stolzl'; src:url('../assets/fonts/stolzl_medium.otf') format('opentype'); font-weight:500; font-display:swap; }
  @font-face { font-family:'Stolzl'; src:url('../assets/fonts/stolzl_bold.otf') format('opentype'); font-weight:700; font-display:swap; }
  @font-face { font-family:'IvyPresto'; src:url('../assets/fonts/ivy-presto-semibold.otf') format('opentype'); font-weight:600; font-display:swap; }
  :root { --navy:#00143F; --cream:#EFEAE7; --cream-2:#F5F1EE; --teal:#578A8B; --gold:#DCAD67; --blush:#E5C3B9;
          --navy-10:rgba(0,20,63,.10); --navy-12:rgba(0,20,63,.12); --navy-55:rgba(0,20,63,.55); --navy-80:rgba(0,20,63,.80);
          --sans:'Stolzl','Archivo',-apple-system,system-ui,sans-serif; --serif:'IvyPresto','Fraunces',Georgia,serif; --body:'Kanit','Montserrat',sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px;
         background:var(--cream); color:var(--navy); font-family:var(--body); padding:32px 16px; -webkit-font-smoothing:antialiased; }
  body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.035; mix-blend-mode:multiply;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
  .logo { width:180px; height:auto; display:block; }
  .card { position:relative; width:100%; max-width:440px; background:#fff; border:1px solid var(--navy-10); border-radius:28px;
          padding:36px 32px 30px; box-shadow:0 30px 60px -40px rgba(0,20,63,.45); }
  .eyebrow { display:inline-flex; align-items:center; gap:9px; font-family:var(--serif); font-style:italic; font-weight:600; font-size:15.5px;
             text-transform:lowercase; color:var(--navy-80); border:1px solid var(--navy-10); background:var(--cream-2); padding:5px 16px 5px 10px; border-radius:30px; }
  .eyebrow .dot { width:8px; height:8px; border-radius:50%; background:var(--gold); }
  h1 { font-family:var(--sans); font-weight:700; font-size:34px; line-height:1.05; letter-spacing:-.03em; margin:18px 0 10px; }
  h1 .cad { display:block; font-family:var(--serif); font-style:italic; font-weight:600; letter-spacing:-.01em; text-transform:lowercase; color:var(--teal); font-size:1.08em; }
  .lead { font-weight:300; font-size:16px; line-height:1.45; color:var(--navy-80); margin-bottom:24px; }
  label[for=pw] { display:block; font-family:var(--sans); font-weight:500; font-size:14px; margin-bottom:8px; }
  input[type=password] { width:100%; font-family:var(--body); font-size:17px; padding:14px 18px; border:1.5px solid var(--navy-12); border-radius:16px;
                         background:var(--cream-2); color:var(--navy); outline:none; transition:border-color .15s, background .15s; }
  input[type=password]:focus { border-color:var(--navy); background:#fff; }
  .remember { display:flex; gap:10px; align-items:center; font-size:15px; color:var(--navy-80); margin:14px 0 22px; cursor:pointer; }
  .remember input { width:18px; height:18px; accent-color:var(--navy); }
  button { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:10px; font-family:var(--sans); font-weight:500; font-size:16px;
           padding:16px 30px; border:0; border-radius:40px; background:var(--navy); color:var(--cream); cursor:pointer;
           box-shadow:0 10px 30px -14px rgba(0,20,63,.7); transition:transform .15s ease, box-shadow .2s; }
  button:hover { transform:translateY(-2px); box-shadow:0 18px 40px -16px rgba(0,20,63,.8); }
  button .arrow { color:var(--gold); transition:transform .2s ease; }
  button:hover .arrow { transform:translateX(4px); }
  button:disabled { opacity:.7; cursor:wait; transform:none; }
  .err { color:#B42318; font-size:14px; min-height:20px; margin-top:12px; text-align:center; }
  .foot { font-size:13px; color:var(--navy-55); text-align:center; }
  @media (max-width:420px) { .card { padding:28px 22px 24px; } h1 { font-size:29px; } }
</style>
</head>
<body>
<img class="logo" src="${logo}" alt="Base Brands">
<form class="card" id="f">
  <span class="eyebrow"><span class="dot"></span>private preview</span>
  <h1>${title}<span class="cad">${subtitle}</span></h1>
  <p class="lead">Enter the password we sent you to open this preview.</p>
  <label for="pw">Password</label>
  <input id="pw" type="password" autocomplete="current-password" autofocus required>
  <label class="remember"><input id="rm" type="checkbox" checked> Remember me on this device</label>
  <button id="go" type="submit"><span id="go-txt">Open</span><span class="arrow" aria-hidden="true">&rarr;</span></button>
  <p class="err" id="err" role="alert"></p>
</form>
<p class="foot">Prepared for you by Base Brands</p>
<script>
const P = ${payload};
const STORE = 'bb-preview-key:' + location.pathname;
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFromPassword(pw) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:b64(P.s), iterations:P.n }, base, 256);
  return new Uint8Array(bits);
}
async function open(raw) {
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:b64(P.i) }, key, b64(P.d));
  const html = new TextDecoder().decode(plain);
  document.open(); document.write(html); document.close();
}
const toHex = a => Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

(async () => {
  let saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) {}
  if (saved) {
    // Wait until this page has fully loaded. Replacing the document while it is still loading
    // makes the browser append the hub under the password box instead of replacing it.
    document.documentElement.style.visibility = 'hidden';
    if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r, { once: true }));
    await new Promise(r => setTimeout(r, 0));
    try { await open(fromHex(saved)); return; }
    catch (e) { try { localStorage.removeItem(STORE); } catch (e2) {} document.documentElement.style.visibility = ''; }
  }
})();

document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('go'), err = document.getElementById('err');
  btn.disabled = true; document.getElementById('go-txt').textContent = 'Opening...'; err.textContent = '';
  try {
    const remember = document.getElementById('rm').checked;
    const raw = await keyFromPassword(document.getElementById('pw').value);
    await open(raw);
    if (remember) { try { localStorage.setItem(STORE, toHex(raw)); } catch (e) {} }
  } catch (x) {
    err.textContent = 'That password did not work. Please try again.';
    btn.disabled = false; document.getElementById('go-txt').textContent = 'Open';
  }
});
</script>
</body>
</html>
`;

const outDir = join(repoRoot, slug);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), page);
console.log(`Locked preview written to ${slug}/index.html`);
