// Gestão do Rebanho — Firebase simulado para os testes automáticos (não é carregado pelo app).
// Intercepta, no navegador do Playwright, o login (Firebase Auth REST) e o Realtime Database REST do projeto
// rebanho-2026, guardando tudo em memória. Aplica a mesma regra de acesso do banco real: cada conta só lê e
// grava em /contas/{uid}. Uso:
//   const {instalarFirebaseSimulado, sessaoTeste} = require('./firebase_simulado');
//   const fb = await instalarFirebaseSimulado(context);   // um por teste (compartilhado entre aparelhos)
//   await context.addInitScript(s => localStorage.setItem('rebanho_firebase_session', JSON.stringify(s)), sessaoTeste());
const BANCO_HOST = 'rebanho-2026-default-rtdb.firebaseio.com';

function sessaoTeste(uid = 'u1', email = 't@t.com') {
  return { idToken: 'tok-' + uid, refreshToken: 'ref-' + uid, expiresAt: Date.now() + 3600e3, user: { id: uid, email } };
}

function criarFirebase() {
  const fb = {
    banco: {},                       // árvore do Realtime Database
    usuarios: new Map(),             // email -> {uid, senha}
    tokens: new Map(),               // idToken válido -> uid
    refresh: new Map(),              // refreshToken -> uid
    chamadas: [],                    // [{tipo, metodo, caminho}]
    semRede: false,
    falharRede(on = true) { fb.semRede = !!on; },
    expirarTokens() { fb.tokens.clear(); },
    contaTeste(uid = 'u1', email = 't@t.com', senha = 'senha123') {
      fb.usuarios.set(email, { uid, senha });
      const s = sessaoTeste(uid, email); fb.tokens.set(s.idToken, uid); fb.refresh.set(s.refreshToken, uid);
      return s;
    },
    ler(caminho) { return ler(fb.banco, partes(caminho)); },
  };
  return fb;
}
// Caminho da URL: o servidor decodifica %XX uma vez. Chaves dentro do corpo do PATCH não são decodificadas.
const partes = c => String(c || '').split('/').filter(Boolean).map(decodeURIComponent);
function ler(no, ps) { for (const p of ps) { if (no == null || typeof no !== 'object') return null; no = no[p]; } return no === undefined ? null : no; }
function gravar(raiz, ps, valor) {
  if (!ps.length) return;
  let no = raiz;
  for (const p of ps.slice(0, -1)) { if (no[p] == null || typeof no[p] !== 'object') no[p] = {}; no = no[p]; }
  const ult = ps[ps.length - 1];
  if (valor === null || valor === undefined) delete no[ult];
  else if (valor && typeof valor === 'object' && valor['.sv'] === 'timestamp') no[ult] = Date.now(); // valor do servidor
  else no[ult] = JSON.parse(JSON.stringify(valor)); // como o Firebase: guarda uma cópia
}

async function instalarFirebaseSimulado(context, fbExistente) {
  const fb = fbExistente || criarFirebase();
  let n = 0;
  const novaSessao = (uid, email) => {
    const idToken = 'tok-' + uid + '-' + (++n), refreshToken = 'ref-' + uid + '-' + n;
    fb.tokens.set(idToken, uid); fb.refresh.set(refreshToken, uid);
    return { idToken, refreshToken, expiresIn: '3600', localId: uid, email };
  };
  const json = (route, corpo, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  const erroAuth = (route, msg) => json(route, { error: { code: 400, message: msg } }, 400);

  await context.route('**/identitytoolkit.googleapis.com/**', async route => {
    if (fb.semRede) return route.abort('failed');
    const u = new URL(route.request().url()), acao = u.pathname.split(':').pop(), b = JSON.parse(route.request().postData() || '{}');
    fb.chamadas.push({ tipo: 'auth', metodo: acao });
    if (acao === 'signUp') {
      if (fb.usuarios.has(b.email)) return erroAuth(route, 'EMAIL_EXISTS');
      if (!b.password || b.password.length < 6) return erroAuth(route, 'WEAK_PASSWORD : Password should be at least 6 characters');
      const uid = 'uid' + (fb.usuarios.size + 1) + 'x'; fb.usuarios.set(b.email, { uid, senha: b.password });
      return json(route, novaSessao(uid, b.email));
    }
    if (acao === 'signInWithPassword') {
      const c = fb.usuarios.get(b.email);
      if (!c || c.senha !== b.password) return erroAuth(route, 'INVALID_LOGIN_CREDENTIALS');
      return json(route, novaSessao(c.uid, b.email));
    }
    if (acao === 'sendOobCode') {
      if (!fb.usuarios.has(b.email)) return erroAuth(route, 'EMAIL_NOT_FOUND');
      return json(route, { email: b.email });
    }
    return erroAuth(route, 'OPERATION_NOT_ALLOWED');
  });

  await context.route('**/securetoken.googleapis.com/**', async route => {
    if (fb.semRede) return route.abort('failed');
    fb.chamadas.push({ tipo: 'refresh' });
    const corpo = new URLSearchParams(route.request().postData() || ''), uid = fb.refresh.get(corpo.get('refresh_token'));
    if (!uid) return erroAuth(route, 'INVALID_REFRESH_TOKEN');
    const s = novaSessao(uid, '');
    return json(route, { id_token: s.idToken, refresh_token: s.refreshToken, expires_in: '3600', user_id: uid });
  });

  await context.route('https://' + BANCO_HOST + '/**', async route => {
    if (fb.semRede) return route.abort('failed');
    const req = route.request(), u = new URL(req.url()), metodo = req.method();
    const caminho = u.pathname.replace(/\.json$/, ''), ps = partes(caminho);
    fb.chamadas.push({ tipo: 'banco', metodo, caminho });
    const auth = u.searchParams.get('auth'), uid = fb.tokens.get(auth);
    if (!uid) return json(route, { error: auth ? 'Auth token is expired' : 'Permission denied' }, 401);
    if (ps[0] !== 'contas' || ps[1] !== uid) return json(route, { error: 'Permission denied' }, 401);
    const corpo = req.postData() ? JSON.parse(req.postData()) : null;
    if (metodo === 'GET') {
      const v = ler(fb.banco, ps);
      if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') return json(route, Object.fromEntries(Object.keys(v).map(k => [k, true])));
      return json(route, v);
    }
    if (metodo === 'PUT') { gravar(fb.banco, ps, corpo); return json(route, corpo); }
    if (metodo === 'PATCH') { for (const [k, v] of Object.entries(corpo || {})) gravar(fb.banco, ps.concat(String(k).split('/').filter(Boolean)), v); return json(route, corpo); }
    if (metodo === 'DELETE') { gravar(fb.banco, ps, null); return json(route, null); }
    return json(route, { error: 'método não suportado' }, 405);
  });
  await context.route('**/*.supabase.co/**', route => route.abort('failed'));
  return fb;
}

module.exports = { instalarFirebaseSimulado, criarFirebase, sessaoTeste };
