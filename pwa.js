/* Tečkovník – napojení na vlastní server (Supabase): úložiště, spolupráce v reálném čase, přihlášení.
   Nastavení adresy a klíče je v souboru config.js. */
(() => {
'use strict';
const cfg = window.TK_CONFIG || {};
const configured = typeof cfg.supabaseUrl === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl)
  && typeof cfg.supabaseKey === 'string' && cfg.supabaseKey.length > 20 && !/VLOZ/i.test(cfg.supabaseKey);
let sb = null, user = null;
const names = {};
function rid(n = 8){ const a = 'abcdefghijkmnopqrstuvwxyz23456789'; let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(n))) s += a[b % a.length]; return s; }
const PEER = rid(10);
const myName = () => (user && user.user_metadata && user.user_metadata.name) || (user && user.email ? user.email.split('@')[0] : 'Já');

/* převod chyb Supabase na kódy, kterým rozumí aplikace */
function err(e){
  const m = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
  const code = /42501|row-level security|permission denied/i.test(m) ? 'invalid_argument'
    : /JWT|not authenticated|401/i.test(m) ? 'revoked'
    : /check constraint|too large|payload/i.test(m) ? 'quota_exceeded' : 'unavailable';
  return { code, message: (e && e.message) || String(e) };
}

/* ---------- úložiště ---------- */
function makeStore(){
  const caches = {};
  const cache = t => caches[t] || (caches[t] = new Map());
  async function upsert(table, row){ const { error } = await sb.from(table).upsert(row); if (error) throw err(error); }
  return {
    kind: 'db',
    watch(name, cb, onErr){
      const map = cache(name);
      const emit = () => cb([...map.values()]);
      const load = async () => {
        const { data, error } = await sb.from(name).select('id,data');
        if (error){ onErr && onErr(err(error)); return; }
        map.clear(); for (const r of data) if (r && r.data && typeof r.data === 'object') map.set(r.id, { ...r.data, id: r.id });
        emit();
      };
      const ch = sb.channel('tbl-' + name + '-' + rid(4))
        .on('postgres_changes', { event: '*', schema: 'public', table: name }, pl => {
          if (pl.eventType === 'DELETE'){ if (pl.old && pl.old.id) map.delete(pl.old.id); }
          else if (pl.new && pl.new.data && typeof pl.new.data === 'object') map.set(pl.new.id, { ...pl.new.data, id: pl.new.id });
          emit();
        })
        .subscribe(status => { if (status === 'SUBSCRIBED') load(); });   // i po výpadku spojení: načte vše znovu
      return () => sb.removeChannel(ch);
    },
    set(path, data){
      const [t, id] = path.split('/'); const clean = { ...data }; delete clean.id;
      cache(t).set(id, { ...clean, id });
      return upsert(t, { id, data: clean });
    },
    update(path, patch){
      const [t, id] = path.split('/'); const cur = cache(t).get(id) || {};
      const next = { ...cur, ...patch }; delete next.id;
      return this.set(path, next);
    },
    watchChunks(pid, cb, onErr){
      const load = async () => {
        const { data, error } = await sb.from('chunks').select('data').eq('page_id', pid);
        if (error){ onErr && onErr(err(error)); return; }
        cb(data.map(r => r.data));
      };
      const ch = sb.channel('chk-' + pid + '-' + rid(4))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chunks', filter: 'page_id=eq.' + pid }, pl => { if (pl.new && pl.new.data) cb([pl.new.data]); })
        .subscribe(status => { if (status === 'SUBSCRIBED') load(); });
      return () => sb.removeChannel(ch);
    },
    saveChunk(pid, id, body){ return upsert('chunks', { id: pid + '~' + id, page_id: pid, data: body }); },
    async getChunks(pid){ const { data, error } = await sb.from('chunks').select('data').eq('page_id', pid); if (error) throw err(error); return data.map(r => r.data); }
  };
}

/* ---------- spolupráce: kdo je na stránce, kurzory, rozpracované tahy ---------- */
function makeRoom(){
  return {
    join(name){
      const peers = new Map(); let cb = null, state = {}, lastSend = 0, timer = null, joined = false;
      const ch = sb.channel('room-' + name, { config: { broadcast: { self: false }, presence: { key: PEER } } });
      const fire = (left = []) => { if (cb) cb({ peers: [...peers.values()], left }); };
      const send = () => {
        timer = null; lastSend = Date.now();
        if (!joined || !peers.size) return;                      // nikdo jiný tu není: nic neposílat
        ch.send({ type: 'broadcast', event: 'p', payload: { peer: PEER, by: user.id, name: myName(), s: state } }).catch(() => {});
      };
      ch.on('broadcast', { event: 'p' }, ({ payload: pl }) => {
        if (!pl || typeof pl.peer !== 'string' || pl.peer === PEER) return;
        const p = peers.get(pl.peer) || { peer: pl.peer, kind: 'viewer', sameTab: false };
        p.by = typeof pl.by === 'string' ? pl.by : null;
        p.presence = pl.s && typeof pl.s === 'object' ? pl.s : {};
        if (p.by && typeof pl.name === 'string') names[p.by] = pl.name.slice(0, 40);
        peers.set(pl.peer, p); fire();
      });
      ch.on('presence', { event: 'sync' }, () => {
        const stt = ch.presenceState(), keys = new Set(Object.keys(stt)), left = [];
        for (const [k, p] of [...peers]) if (!keys.has(k)){ left.push(p); peers.delete(k); }
        let fresh = false;
        for (const k of keys){
          if (k === PEER || peers.has(k)) continue;
          const m = (stt[k] && stt[k][0]) || {};
          peers.set(k, { peer: k, by: typeof m.by === 'string' ? m.by : null, kind: 'viewer', sameTab: false, presence: {} });
          if (m.by && m.name) names[m.by] = String(m.name).slice(0, 40);
          fresh = true;
        }
        fire(left); if (fresh) send();
      });
      ch.subscribe(async status => { if (status === 'SUBSCRIBED'){ joined = true; try { await ch.track({ by: user.id, name: myName() }); } catch {} } });
      return {
        presence(patch){
          Object.assign(state, patch);
          if (!timer) timer = setTimeout(send, Math.max(0, 100 - (Date.now() - lastSend)));
          return Promise.resolve();
        },
        onPeers(f){ cb = f; fire(); return () => { cb = null; }; },
        leave(){ clearTimeout(timer); return sb.removeChannel(ch); }
      };
    }
  };
}

/* ---------- přihlašovací obrazovka ---------- */
function loginUI(){
  return new Promise(resolve => {
    const st = document.createElement('style');
    st.textContent = `#login{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:var(--paper);padding:20px}
#login form{width:min(380px,100%);display:flex;flex-direction:column;gap:12px;background:var(--chrome);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:22px}
#login h1{margin:0;font-size:26px;letter-spacing:-.01em}#login p{margin:0;color:var(--muted);font-size:15px;line-height:1.4}
#login input{font:inherit;font-size:17px;height:46px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--paper);color:var(--text);-webkit-user-select:text;user-select:text}
#login button{height:46px;border-radius:9px;background:var(--accent);color:#fff;font-weight:700;font-size:16px}
#login .e{color:var(--bad);font-size:14px;min-height:1.2em}`;
    document.head.appendChild(st);
    const box = document.createElement('div'); box.id = 'login';
    box.innerHTML = `<form autocomplete="on"><h1>Tečkovník</h1><p>Přihlas se účtem, který ti založil správce.</p>
<input type="email" name="email" autocomplete="username" placeholder="E-mail" required>
<input type="password" name="password" autocomplete="current-password" placeholder="Heslo" required>
<button type="submit">Přihlásit</button><div class="e" role="alert"></div></form>`;
    document.body.appendChild(box);
    const form = box.querySelector('form'), msg = box.querySelector('.e'), btn = box.querySelector('button');
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); msg.textContent = ''; btn.disabled = true; btn.textContent = 'Přihlašuji…';
      const { data, error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
      btn.disabled = false; btn.textContent = 'Přihlásit';
      if (error){ msg.textContent = /invalid/i.test(error.message) ? 'Nesprávný e-mail nebo heslo.' : 'Přihlášení selhalo: ' + error.message; return; }
      box.remove(); resolve(data.session);
    });
  });
}

window.TK_PWA = {
  async connect({ toast }){
    if (!configured || !window.supabase){ toast('Aplikace není propojená s databází – vyplň config.js (viz návod). Zatím ukládám jen v tomto zařízení.'); return null; }
    sb = window.supabase.createClient(cfg.supabaseUrl.replace(/\/$/, ''), cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch {}
    if (!session){
      const boot = document.getElementById('boot'); if (boot) boot.classList.add('off');
      session = await loginUI();
      if (boot) boot.classList.remove('off');
    }
    user = session.user;
    sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_OUT') location.reload(); else if (s && s.user) user = s.user; });
    return {
      store: makeStore(), room: makeRoom(),
      user: { id: async () => user.id, can: async () => true, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: names[i] || '' }])) }
    };
  },
  account(){ return user ? { email: user.email, name: myName() } : null; },
  /* obrázky: soukromý bucket „images“ v Supabase Storage (jen pro přihlášené) */
  images: {
    async upload(blob){
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const path = user.id + '/' + rid(14) + '.' + ext;
      const { error } = await sb.storage.from('images').upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
      if (error) throw err(error);
      return 'sb:' + path;
    },
    async src(ref){
      const { data, error } = await sb.storage.from('images').download(ref.replace(/^sb:/, ''));
      if (error) throw err(error);
      return URL.createObjectURL(data);
    }
  },
  async logout(){ try { await sb.auth.signOut(); } catch {} location.reload(); },
  async setName(n){ const { data, error } = await sb.auth.updateUser({ data: { name: n } }); if (error) throw error; user = data.user; },
  async setPassword(pw){ const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; }
};
})();
