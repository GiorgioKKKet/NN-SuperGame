// Banco di prova: Chrome headless, carica il gioco, esegue scenari e raccoglie errori JS.
// uso: node harness.mjs <file.html> <scenari.json> [outdir]
import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const [,, FILE, SCEN, OUT=path.join(path.dirname(new URL(import.meta.url).pathname),'out')] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9300 + Math.floor(Math.random() * 500);
const udir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr-'));
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${udir}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1280,800', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errors = []; const logs = [];
async function connect() { for (let k = 0; k < 50; k++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const pg = l.find(t => t.type === 'page'); if (pg) return pg.webSocketDebuggerUrl; } catch (e) {} await sleep(200); } throw new Error('chrome non risponde'); }
function send(method, params = {}) { return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
async function ev(expr, awaitP = true) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: awaitP }); if (r.exceptionDetails) return { err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return { v: r.result.value }; }
try {
  ws = new WebSocket(await connect()); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n').slice(0, 4).join(' | '));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + path.resolve(FILE) });
  for (let k = 0; k < 100; k++) { await sleep(200); const r = await ev('typeof players!=="undefined"&&typeof showMenu==="function"&&document.readyState==="complete"'); if (r.v) break; }
  await sleep(500); if (errors.length) console.log('LOAD ERRORS:', errors.join('\n'));
  if (!process.env.HQ) await ev('qAuto=false;setQuality(0);1');
  for (const s of JSON.parse(fs.readFileSync(SCEN, 'utf8'))) {
    const e0 = errors.length;
    if (s.pre && !s.mode) { const r = await ev(s.pre); if (r.err) errors.push('[pre] ' + r.err); }
    if (s.mode) { const r = await ev(`(()=>{ if(typeof titleOn!=='undefined'&&titleOn) titleClose&&titleClose(); if(started) backToMenu(); menu.mode=${JSON.stringify(s.mode)}; menu.map=${JSON.stringify(s.map)}; if(MAPS[menu.map]) buildMap(menu.map); menu.n=${s.n}; menu.teams=${JSON.stringify(s.teams||null)}; menu.pick=${JSON.stringify(s.pick)}; startGame(); cdT=0; ${s.pre?s.pre+';':''} ${s.fire!==false?"['KeyQ','Enter','KeyU','Numpad0'].forEach(k=>down.add(k));":''} return matchT; })()`); if (r.err) errors.push('[start] ' + r.err); }
    const mt0 = (await ev('typeof matchT!=="undefined"?matchT:-1')).v;
    for (let k = 0; k < Math.max(1, Math.round(s.secs || 4)); k++) {
      if (s.move !== false && s.mode) await ev(`(()=>{const K=[['KeyW','KeyA','KeyS','KeyD'],['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'],['KeyI','KeyJ','KeyK','KeyL'],['Numpad8','Numpad4','Numpad5','Numpad6']];for(const ks of K){ks.forEach(x=>down.delete(x));down.add(ks[Math.random()*4|0]);}})()`);
      if (s.during) { const r = await ev(s.during); if (r.err) errors.push('[during] ' + r.err); }
      await sleep(1000); }
    const st = (await ev(`JSON.stringify({matchT:+(+matchT).toFixed(2),over,mapKey,MODE,alive:players.filter(p=>p.active&&!p.dead).length,minions:minions.length,proj:projectiles.length,calls:renderer.info.render.calls${s.extra?','+s.extra:''}})`)).v;
    if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, s.shot + '.png'), Buffer.from(r.data, 'base64')); }
    let post; if (s.post) { const r = await ev(s.post); if (r.err) errors.push('[post] ' + r.err); else post = r.v; }
    const stj = st ? JSON.parse(st) : {}; const frozen = s.mode && !(stj.matchT > mt0) && !stj.over;
    const res = { name: s.name || `${s.mode}/${s.map}/${s.pick}`, ...stj, frozen, post, errors: errors.slice(e0) };
    console.log((res.errors.length ? 'FAIL ' : frozen ? 'SLOW ' : 'ok   ') + JSON.stringify(res));
  }
  if (logs.length) console.log('console:', [...new Set(logs)].slice(0, 10).join('\n  '));
} catch (e) { console.log('HARNESS ERROR', e.message); }
finally { try { ws && ws.close(); } catch (e) {} chrome.kill('SIGKILL'); setTimeout(() => { try { fs.rmSync(udir, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 300); }
