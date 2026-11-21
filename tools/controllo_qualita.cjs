#!/usr/bin/env node
/*
 * Controllo qualità PRIMA del push (regola di Vito, 20/11/2026).
 *
 * Rende le pagine con Chromium a 390 px (telefono) e 1280 px (computer),
 * salva gli screenshot a pagina intera e segnala in automatico:
 *   - titoli doppi (stesso testo in due titoli/box della stessa pagina)
 *   - più di un H1, title o meta description vuoti, title con frase ripetuta
 *   - testo segnaposto ([DA COMPLETARE], TODO, lorem ipsum, {{ }}, undefined, NaN)
 *   - foto rotte, sgranate (ingrandite oltre la risoluzione), deformate,
 *     ruotate via CSS, principale sotto i 1600 px
 *   - layout rotto: scroll orizzontale, elementi che escono dallo schermo,
 *     elementi visibili sovrapposti a un titolo
 *
 * Quello che non si vede in automatico (foto storta o non pertinente al tema,
 * blocchi accatastati, gerarchia confusa) si controlla GUARDANDO gli screenshot.
 *
 * Uso:
 *   node controllo_qualita.cjs --dir <cartella del sito generato> <percorso> [<percorso> ...]
 *   node controllo_qualita.cjs <https://url> [<https://url> ...]
 * Opzioni: --dominio https://sito.it (le URL assolute del sito si leggono dalla cartella locale), --out <cartella screenshot> (default ./qa-screenshot), --tutte (tutte le pagine HTML di --dir),
 *          --senza-screenshot (giro veloce: solo i controlli automatici)
 * Esce con codice 1 se trova ERRORI (bloccano il push), 0 se ci sono solo AVVISI o niente.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let dir = null, out = 'qa-screenshot', tutte = false, foto = true, dominio = null;
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir') dir = args[++i];
  else if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--tutte') tutte = true;          // tutte le pagine HTML della cartella
  else if (args[i] === '--senza-screenshot') foto = false; // giro veloce su molte pagine
  else if (args[i] === '--dominio') dominio = args[++i].replace(/\/$/, ''); // URL assolute del sito servite dalla cartella
  else targets.push(args[i]);
}
if (tutte && dir) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return /^(node_modules|\.git|assets|static|img|images|css|js)$/.test(e.name) ? [] : walk(f);
    return e.name.endsWith('.html') && !/^(404|google[0-9a-f]+)\.html$/.test(e.name) ? ['/' + path.relative(dir, f).replace(/index\.html$/, '')] : [];
  });
  targets.push(...walk(dir).sort());
}
if (!targets.length) {
  console.error('Uso: node controllo_qualita.cjs [--dir cartella] [--out cartella] <percorsi o URL>');
  process.exit(2);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.xml': 'application/xml' };

function serve(root) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(root, p);
      if (!f.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
      try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {
        if (fs.existsSync(f + '.html')) f = f + '.html';
      }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Eseguito nella pagina: restituisce {errori:[], avvisi:[]}
async function analizza(vw) {
  const E = [], A = [];
  const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visibile = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const fuoriContenuto = el => !!el.closest('header, nav, footer, [role=navigation], .cookie, #cookie, [class*=consent], [id*=consent]');
  const desc = el => {
    const t = (el.innerText || el.alt || el.getAttribute('src') || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? ' class="' + el.className.split(' ')[0] + '"' : ''}> "${t}"`;
  };

  // Titoli doppi
  const sel = 'h1,h2,h3,h4,h5,[class*=title],[class*=titolo],[class*=heading],legend,figcaption,.box strong,[class*=box] strong,[class*=box] b';
  const visti = new Map();
  for (const el of document.querySelectorAll(sel)) {
    if (!visibile(el) || fuoriContenuto(el)) continue;
    if (el.querySelector(sel)) continue; // solo il più interno
    const t = norm(el.innerText);
    if (t.length < 6) continue;
    if (visti.has(t)) {
      const prima = visti.get(t);
      if (!prima.contains(el) && !el.contains(prima)) {
        const faq = x => !!x.closest('details, [class*=faq], [id*=faq], [itemtype*=FAQ]');
        // domanda ripetuta tra testo e sezione FAQ: avviso; due titoli/box uguali nel contenuto: errore
        if (faq(el) !== faq(prima)) A.push(`Domanda ripetuta tra testo e FAQ: ${desc(el)}`);
        else E.push(`Titolo doppio: ${desc(el)} compare due volte`);
      }
    } else visti.set(t, el);
  }
  // Stessa frase ripetuta di fila in un titolo ("Prenota Prenota", "X X")
  for (const el of document.querySelectorAll('h1,h2,h3,h4')) {
    const t = norm(el.innerText); const h = t.length / 2;
    if (t.length > 10 && t.length % 2 === 1 && t.slice(0, (t.length - 1) / 2) === t.slice((t.length + 1) / 2)) E.push(`Titolo con frase ripetuta: ${desc(el)}`);
    if (t.length > 10 && Number.isInteger(h) && t.slice(0, h) === t.slice(h)) E.push(`Titolo con frase ripetuta: ${desc(el)}`);
  }
  const h1 = [...document.querySelectorAll('h1')].filter(visibile);
  if (h1.length === 0) A.push('Nessun H1 visibile');
  if (h1.length > 1) E.push(`${h1.length} H1 visibili nella pagina`);
  const title = document.title.trim();
  if (!title) E.push('<title> vuoto');
  const parti = title.split(/\s[|\-–·]\s/).map(norm).filter(Boolean);
  if (new Set(parti).size < parti.length) E.push(`<title> con una parte ripetuta: "${title}"`);
  const md = document.querySelector('meta[name=description]');
  if (!md || !md.content.trim()) A.push('meta description mancante o vuota');

  // Segnaposto
  const testo = document.body.innerText + ' ' + title + ' ' + (md ? md.content : '') +
    [...document.querySelectorAll('img')].map(i => ' ' + (i.alt || '')).join('');
  const segnaposto = [/\[DA COMPLETARE[^\]]*\]?/i, /\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /lorem ipsum/i,
    /\{\{[^}]*\}\}/, /\{%[^%]*%\}/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bXXX\b/, /\[(?:link|foto|immagine|image|placeholder)\]/i];
  for (const re of segnaposto) { const m = testo.match(re); if (m) E.push(`Testo segnaposto: "${m[0].slice(0, 60)}"`); }

  // Foto
  const imgs = [...document.querySelectorAll('img')];
  // larghezza reale del file (naturalWidth con srcset "w" è già corretta per la densità e inganna)
  const reale = src => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = src; });
  let principale = null, areaMax = 0;
  for (const img of imgs) {
    if (!visibile(img)) continue;
    const r = img.getBoundingClientRect();
    const nome = (img.currentSrc || img.src || '').split('/').pop().slice(0, 60);
    const locale = (img.currentSrc || img.src || '').startsWith(location.origin);
    if (img.complete && img.naturalWidth === 0) {
      if (locale || !/^http:\/\/127\.0\.0\.1/.test(location.origin)) E.push(`Foto rotta (non si carica): ${nome}`);
      else A.push(`Foto con indirizzo assoluto, non verificabile in locale: ${(img.currentSrc || img.src).slice(0, 90)}`);
      continue;
    }
    if (!img.naturalWidth || /\.svg(\?|$)/i.test(img.currentSrc || img.src)) continue;
    if (r.width * r.height > areaMax && !fuoriContenuto(img)) { areaMax = r.width * r.height; principale = img; }
    const pxFile = img.srcset || (img.parentElement && img.parentElement.tagName === 'PICTURE') ? (await reale(img.currentSrc || img.src)) || img.naturalWidth : img.naturalWidth;
    const scala = pxFile / r.width;
    if (r.width >= 120) {
      if (scala < 0.9) E.push(`Foto sgranata: ${nome} è ${pxFile} px ma mostrata a ${Math.round(r.width)} px`);
      else if (scala < 1) A.push(`Foto leggermente ingrandita: ${nome} ${pxFile} px mostrata a ${Math.round(r.width)} px`);
      else if (scala < 1.5 && vw >= 1000) A.push(`Foto al limite: ${nome} ${pxFile} px per ${Math.round(r.width)} px mostrati (su schermi retina sembra morbida)`);
    }
    const fit = getComputedStyle(img).objectFit;
    if (fit === 'fill' || fit === '') {
      const ra = r.width / r.height, na = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ra / na - 1) > 0.04) E.push(`Foto deformata: ${nome} (proporzioni ${na.toFixed(2)} mostrate a ${ra.toFixed(2)})`);
    }
    let n = img; while (n && n !== document.body) {
      const tr = getComputedStyle(n).transform;
      if (tr && tr !== 'none') { const m = tr.match(/matrix\(([^,]+),\s*([^,]+)/); if (m && Math.abs(parseFloat(m[2])) > 0.01) { E.push(`Foto ruotata via CSS: ${nome}`); break; } }
      n = n.parentElement;
    }
    if (!img.alt || !img.alt.trim()) A.push(`Foto senza testo alternativo: ${nome}`);
  }
  if (vw >= 1000 && principale && principale.naturalWidth < 1600 && principale.getBoundingClientRect().width > vw * 0.5)
    A.push(`Foto principale sotto i 1600 px: ${(principale.currentSrc || principale.src).split('/').pop()} (${principale.naturalWidth} px)`);

  // Layout
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 2) E.push(`Scroll orizzontale: la pagina è larga ${sw} px su uno schermo di ${vw} px`);
  const usciti = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    if (!visibile(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2 && r.width < vw * 3) {
      let p = el.parentElement, scroll = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { scroll = true; break; } p = p.parentElement; }
      if (!scroll && !usciti.has(el.parentElement)) { usciti.add(el); if (usciti.size <= 5) E.push(`Esce dallo schermo: ${desc(el)} (bordo destro a ${Math.round(r.right)} px)`); }
    }
  }
  // Sovrapposizioni: un titolo coperto da un altro elemento non trasparente
  for (const el of document.querySelectorAll('h1,h2,h3')) {
    if (!visibile(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) continue;
    const x = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (top && !el.contains(top) && !top.contains(el) && !fuoriContenuto(top)) A.push(`Titolo coperto da un altro elemento: ${desc(el)} sotto ${desc(top)}`);
  }
  return { errori: [...new Set(E)], avvisi: [...new Set(A)] };
}

(async () => {
  let base = null, srv = null;
  if (dir) { srv = await serve(path.resolve(dir)); base = `http://127.0.0.1:${srv.address().port}`; }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let totErr = 0, totAvv = 0;
  for (const t of targets) {
    const url = /^https?:/.test(t) ? t : base + (t.startsWith('/') ? t : '/' + t);
    console.log(`\n=== ${t}`);
    for (const [nome, vw, vh] of [['telefono', 390, 844], ['computer', 1280, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: vw < 500, hasTouch: vw < 500 });
      const page = await ctx.newPage();
      // in locale: niente richieste esterne (analytics, font, widget) che rallentano e non servono al controllo
      if (base) await page.route(u => !u.href.startsWith(base), route => {
        const u = route.request().url();
        if (dominio && u.startsWith(dominio)) {
          let f = path.join(dir, decodeURIComponent(u.slice(dominio.length).split(/[?#]/)[0]));
          try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {}
          if (fs.existsSync(f)) return route.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
          return route.fulfill({ status: 404, body: '' });
        }
        return route.abort();
      });
      const rotte = [];
      page.on('response', r => { if (r.status() >= 400 && r.request().resourceType() === 'image') rotte.push(r.url()); });
      let res;
      try { res = await page.goto(url, { waitUntil: base ? 'load' : 'networkidle', timeout: 45000 }); }
      catch (e) { console.log(`  [${nome}] ERRORE: pagina non caricata (${e.message.split('\n')[0]})`); totErr++; await ctx.close(); continue; }
      if (!res || res.status() >= 400) { console.log(`  [${nome}] ERRORE: HTTP ${res ? res.status() : '?'}`); totErr++; }
      // carica le immagini lazy scorrendo la pagina
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(400);
      const r = await page.evaluate(analizza, vw);
      for (const u of rotte) r.errori.push(`Immagine non trovata (HTTP 4xx): ${u.split('/').pop()}`);
      const file = path.join(out, `${t.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${nome}.png`);
      if (foto) { await page.screenshot({ path: file, fullPage: true }); console.log(`  [${nome} ${vw}px] screenshot: ${file}`); }
      for (const e of [...new Set(r.errori)]) console.log(`    ERRORE: ${e}`);
      for (const a of r.avvisi) console.log(`    avviso: ${a}`);
      totErr += new Set(r.errori).size; totAvv += r.avvisi.length;
      await ctx.close();
    }
  }
  await browser.close();
  if (srv) srv.close();
  console.log(`\nTotale: ${totErr} errori, ${totAvv} avvisi.`);
  console.log(totErr ? 'NON fare push: correggi gli errori e rilancia.' : 'Nessun errore automatico. Ora GUARDA gli screenshot (foto storte o non a tema, blocchi accatastati) prima del push.');
  process.exit(totErr ? 1 : 0);
})();
