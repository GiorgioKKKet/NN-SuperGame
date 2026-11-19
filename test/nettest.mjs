// Prova host+client: due schede, una connessione finta che porta gli snapshot dall'host al client.
// uso: node nettest.mjs <server.html> <gioco.html> <scenari.json>
import { spawn } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
const [,, HOST, CLI, SCEN] = process.argv; const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const PORT = 9300 + Math.floor(Math.random() * 500), udir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr-'));
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${udir}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(url) {
  let l; for (let k = 0; k < 50; k++) { try { l = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch (e) { await sleep(200); } }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); p(d.result); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | ')); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? { err: r.exceptionDetails.exception?.description?.split('\n')[0] } : { v: r.result.value }; };
  await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Page.navigate', { url: 'file://' + path.resolve(url) });
  for (let k = 0; k < 100; k++) { await sleep(200); const r = await ev('typeof players!=="undefined"&&document.readyState==="complete"'); if (r.v) break; }
  await sleep(400); await ev('qAuto=false;setQuality(0);1'); return { ev, send, errors, ws };
}
try {
  const H = await page(HOST), C = await page(CLI);
  await H.ev(`renderScene=function(){}; window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),16); requestAnimationFrame(loop); window.__out=[]; window.__fc={peer:'fake',open:true,on(e,f){this['_'+e]=f;},send(m){__out.push(JSON.stringify(m));},close(){}}; hostConn(__fc); __fc._open(); 1`);
  await C.ev(`window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),16); requestAnimationFrame(loop); NET.client=true; NET.conn={open:true,send(){},close(){}}; NET.myChar=0; 1`);
  for (const s of JSON.parse(fs.readFileSync(SCEN, 'utf8'))) {
    const e0h = H.errors.length, e0c = C.errors.length;
    const r = await H.ev(`(()=>{ if(started) backToMenu(); menu.mode=${JSON.stringify(s.mode)}; menu.map=${JSON.stringify(s.map)}; buildMap(menu.map); menu.n=${s.n}; menu.teams=${JSON.stringify(s.teams || null)}; menu.pick=${JSON.stringify(s.pick)}; startGame(); cdT=0; ${s.pre || ''}; ['KeyQ','Enter','KeyU','Numpad0'].forEach(k=>down.add(k)); return 1; })()`);
    if (r.err) H.errors.push('[start] ' + r.err);
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < (s.secs || 5) * 1000) {
      if (s.during) await H.ev(s.during);
      const q = (await H.ev('JSON.stringify(__out.splice(0))')).v || '[]';
      const arr = JSON.parse(q); n += arr.length;
      if (arr.length) { const rr = await C.ev(`(()=>{ for(const m of ${JSON.stringify(arr)}) clientData(JSON.parse(m)); return 1; })()`); if (rr.err) C.errors.push('[data] ' + rr.err); }
      await sleep(60);
    }
    if (s.cliDuring) await C.ev(s.cliDuring);
    if (s.hostExtra) console.log("host:", (await H.ev(s.hostExtra)).v);
    await sleep(300);
    const st = (await C.ev(`JSON.stringify({mapKey,view:!!NET.view,proj:projectiles.length,minions:minions.length,${s.extra || ''}})`)).v;
    if (s.shot) { const r = await C.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, s.shot + '.png'), Buffer.from(r.data, 'base64')); }
    const res = { name: `${s.mode}/${s.map}`, msgs: n, cli: st && JSON.parse(st), hostErr: H.errors.slice(e0h), cliErr: C.errors.slice(e0c) };
    console.log((res.hostErr.length || res.cliErr.length ? 'FAIL ' : 'ok   ') + JSON.stringify(res));
  }
} catch (e) { console.log('NETTEST ERROR', e.stack); }
finally { chrome.kill('SIGKILL'); setTimeout(() => { try { fs.rmSync(udir, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 300); }
