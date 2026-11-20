# Migração da nuvem para o Firebase — Plano de implementação (Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o transporte da nuvem (login, sincronização, cópia na nuvem, perfil) do Supabase para o Firebase
Realtime Database + Firebase Auth, via REST, sem mudar telas, cálculos nem dados do aparelho, e publicar só no app de teste.

**Architecture:** `js/app/01-config-conta.js` passa a ter a configuração do Firebase, a sessão e `fbFetch` (REST do
Realtime Database com `?auth=idToken` e renovação do token). `js/app/09-perfil-nuvem-sincronizacao.js` mantém o mesmo
mecanismo de sincronização (pendências, conflito pelo mais novo, manifesto leve + registros completos), trocando só as
chamadas. Árvore: `/contas/{uid}/{fazenda, manifesto/{store}/{chave}, registros/{store}/{chave}, backups/{device}, perfil}`.

**Tech Stack:** JavaScript de script clássico (funções globais), IndexedDB, Firebase Auth REST (identitytoolkit /
securetoken), Realtime Database REST, Playwright para testes com Firebase simulado.

**Spec:** `docs/superpowers/specs/2026-11-20-migracao-firebase-design.md`

## Global Constraints
- Projeto Firebase único `rebanho-2026`: apiKey `AIzaSyCiIE3LgZbyUcUbkYzcTuCDw1a2mPnXHfE`, authDomain
  `rebanho-2026.firebaseapp.com`, databaseURL `https://rebanho-2026-default-rtdb.firebaseio.com`, projectId `rebanho-2026`
  (sem `measurementId`/Analytics no app).
- Sem biblioteca do Firebase; sem store nova no IndexedDB; dados locais não mudam de formato.
- O mesmo código e a mesma configuração nos dois repositórios (fim da troca de chaves na publicação).
- Datas de fatos não podem ser no futuro; registros `partida_contabil` seguem as regras atuais (nada muda aqui).
- Publicação desta fase: SÓ `profsaulojardim/gestaoagro` (app de teste). Produção só na Fase 4.
- Organização (CLAUDE.md): código no arquivo do assunto, nada duplicado, ARQUITETURA.md e testes/ atualizados,
  commit `VN: ...` em português, versão em `sw.js`.

## Review Focus
1. Ids com `.` (ex.: `uid()` antigo = `"1700000000000-0.123"`) e outros caracteres proibidos em chaves do Realtime
   Database (`. # $ [ ] /`) — devem ser gravados e lidos de volta iguais (Task 3, teste `chaves com ponto`).
2. Listas vazias e campos `null` dentro dos registros (ex.: `animalIds: []`) — devem voltar iguais; por isso o payload
   vai como texto JSON (Task 3, teste `payload com lista vazia`).
3. Token expirado no meio da sincronização (1 h) — renova sozinho e repete a chamada uma vez (Task 2, teste `renova token`).
4. Sem internet / servidor fora — mensagem "Sem conexão com o servidor…", nada marcado como enviado (Task 4).
5. Segundo aparelho entrando depois: recebe tudo do primeiro, e registros seus que só existiam nele sobem; a fazenda é a
   mesma (Task 3, teste de dois aparelhos).

---

### Task 1: Firebase simulado para os testes e nova chave de sessão nos testes existentes

**Files:**
- Create: `testes/firebase_simulado.js` (módulo usado pelos testes; não é carregado pelo app)
- Modify: `testes/navegacao_voltar.js`, `testes/animais_servico.js`, `testes/venda_selecao_fotos.js`, `testes/escolha_mae.js`
  (troca `rebanho_supabase_session` pela sessão nova)

**Interfaces:**
- Produces: `instalarFirebaseSimulado(context, opcoes) -> {banco, usuarios, chamadas, falharRede(bool), expirarTokens()}`
  — intercepta `identitytoolkit.googleapis.com/v1/accounts:{signUp,signInWithPassword,sendOobCode}`,
  `securetoken.googleapis.com/v1/token` e `rebanho-2026-default-rtdb.firebaseio.com/**.json` (GET, PUT, PATCH
  multi-caminho, DELETE); valida `?auth=` (token inválido/expirado → 401 `{"error":"Auth token is expired"}`); aplica a
  regra `contas/$uid` (outra conta → 401 `Permission denied`).
- Produces: `sessaoTeste(uid='u1', email='t@t.com')` → objeto para `localStorage['rebanho_firebase_session']`:
  `{idToken:'tok-u1', refreshToken:'ref-u1', expiresAt: Date.now()+3600e3, user:{id:'u1', email}}`.

- [ ] Step 1: Escrever o módulo; erros de auth no formato do Firebase: `{error:{message:'EMAIL_EXISTS'}}`,
  `INVALID_LOGIN_CREDENTIALS`, `WEAK_PASSWORD : Password should be at least 6 characters`.
- [ ] Step 2: Trocar a sessão nos 4 testes existentes por `sessaoTeste()` e bloquear `*.supabase.co` continua.
- [ ] Step 3: `node --check testes/firebase_simulado.js` → sem erro. (Os 4 testes voltam a passar no fim da Task 2,
  quando o app passa a ler a sessão nova.)
- [ ] Step 4: Commit.

### Task 2: Sessão e chamadas ao Firebase (`01-config-conta.js`)

**Files:**
- Modify: `js/app/01-config-conta.js` (substitui `SUPABASE_*`, `sbFetch`, `refreshAuthSession`, `authUser`)
- Test: `testes/nuvem_firebase.js` (novo; cresce nas Tasks 3–5)

**Interfaces:**
- Produces: `const FIREBASE_CONFIG={apiKey,authDomain,databaseURL,projectId}`; `AUTH_STORAGE_KEY="rebanho_firebase_session"`.
- Produces: `authSession()`, `saveAuthSession(s)` (mesmos nomes); sessão `{idToken, refreshToken, expiresAt, user:{id, email, user_metadata:{full_name}}}`.
- Produces: `async fbAuth(acao: "signUp"|"signInWithPassword"|"sendOobCode", corpo) -> objeto` (lança `Error(codigoFirebase)`).
- Produces: `sessaoDeRespostaAuth(b, nome?) -> sessão` (de `{idToken, refreshToken, expiresIn, localId, email}`).
- Produces: `async refreshAuthSession() -> boolean` (POST form `grant_type=refresh_token&refresh_token=…` em
  `https://securetoken.googleapis.com/v1/token?key=…`; resposta `{id_token, refresh_token, expires_in, user_id}`).
- Produces: `async fbFetch(caminho: string, {method='GET', body, query}={}) -> json` — URL
  `${databaseURL}/contas/${uid}${caminho}.json?auth=${idToken}` (+ `query`); renova antes se faltar < 60 s; em 401 renova
  e repete 1 vez; falha de rede → `Error("Sem conexão com o servidor. Verifique a internet e tente de novo.")`.
- Produces: `async authUser()` → `session.user` ou `null` (sem chamada de rede).

- [ ] Step 1: Testes em `testes/nuvem_firebase.js`: `fbFetch grava e lê` (PUT `/perfil` e GET devolve igual);
  `renova token` (simulado com `expirarTokens()` → chamada seguinte ainda funciona e `securetoken` foi chamado 1 vez);
  `outra conta bloqueada` (fbFetch com uid trocado → erro).
- [ ] Step 2: Rodar — falha (`fbFetch is not defined`).
- [ ] Step 3: Implementar.
- [ ] Step 4: Rodar — passa; os 4 testes da Task 1 também. `node --check` em todos os `js/`.
- [ ] Step 5: Commit.

### Task 3: Fazenda, primeira entrada e sincronização pelo Realtime Database (`09`)

**Files:**
- Modify: `js/app/09-perfil-nuvem-sincronizacao.js` (`cloudOrgId`, `prepararContaLocal`, `versoesMaisNovasNaNuvem`,
  `pushPendentes`, `pullCloud`; remove `marcarTudoSincronizado`, que não faz nada)
- Modify: `testes/sincronizacao_dois_aparelhos.js` (passa a usar `firebase_simulado.js`)
- Test: `testes/nuvem_firebase.js`

**Interfaces:**
- Consumes: `fbFetch`, `authUser` (Task 2).
- Produces: `chaveFirebase(id) -> string` e `idDaChave(chave) -> string` (codifica `. # $ [ ] / %` como `%2E` etc.; ida e volta exata).
- Produces: `async cloudOrgId() -> string` — lê `/fazenda`; se vazio grava `meta.active_org_id || meta.legacy_claimed_org_id || uid` e devolve.
- Produces: `prepararContaLocal()` — na PRIMEIRA entrada no Firebase deste aparelho (`meta.firebase_uid !== uid`):
  registros locais com `organization_id` vazio ou igual ao `active_org_id` anterior passam para a fazenda e ficam
  pendentes (`synced` → `pending_update`); grava `meta.firebase_uid=uid` e `meta.conferencia_pendente=true`.
- Produces: formato na nuvem `registros/{store}/{chave} = {p: JSON.stringify(payloadSync(o)), u, v, d, dev}` e
  `manifesto/{store}/{chave} = {u, v, d}`; envio por lote de 25 com UM `PATCH /contas/{uid}` multi-caminho.
- Produces: `linhaDaNuvem(store, chave, reg, fazenda) -> row` no formato que `cloudRecordToLocal` já entende.
- `pullCloud(org)`: manifesto por store (`GET /manifesto/{store}`); se precisar de > 40 registros baixa a store inteira
  (`GET /registros/{store}`), senão um a um.

- [ ] Step 1: Testes: `primeira entrada envia tudo` (aparelho com 3 animais `synced` de Supabase → após sincronizar, 3 no
  manifesto e locais `synced`); `chaves com ponto` (id `1700-0.5` ida e volta); `payload com lista vazia`
  (`animalIds:[]` volta `[]`); `segundo aparelho` (o `sincronizacao_dois_aparelhos.js` adaptado: edição em A aparece
  em B, exclusão propaga, edição antiga offline não sobrescreve a nova).
- [ ] Step 2: Rodar — falha.
- [ ] Step 3: Implementar.
- [ ] Step 4: Rodar `nuvem_firebase.js` e `sincronizacao_dois_aparelhos.js` — `OK`.
- [ ] Step 5: Commit.

### Task 4: Telas de conta (entrar, criar conta, esqueci a senha, sair) e mensagens

**Files:**
- Modify: `js/app/09-perfil-nuvem-sincronizacao.js` (`formEntrarCloud`, `entrarCloud`, `criarContaCloud`,
  `sairCloud`, `traduzirErroAuth`, novo `esqueciSenhaCloud`, `sincronizarAgora` usa a tradução de erro)
- Test: `testes/nuvem_firebase.js`

**Interfaces:**
- `criarContaCloud()`: `fbAuth("signUp")` → já entra (Firebase não exige confirmar e-mail), grava `/perfil.full_name`,
  `prepararContaLocal`, sincroniza, fecha e vai ao Início.
- `entrarCloud()`: `fbAuth("signInWithPassword")`; aviso fixo na tela de entrar: "Nova nuvem (V182): no primeiro acesso,
  toque em Criar conta com o mesmo e-mail e uma senha nova."
- `esqueciSenhaCloud()`: `fbAuth("sendOobCode",{requestType:"PASSWORD_RESET",email})` → "Enviamos um link para …".
- `traduzirErroAuth(msg)`: `EMAIL_EXISTS` → "Este e-mail já tem conta nesta nuvem. Use Entrar."; `INVALID_LOGIN_CREDENTIALS`,
  `INVALID_PASSWORD`, `EMAIL_NOT_FOUND` → "E-mail ou senha incorretos. Primeiro acesso na nova nuvem? Use Criar conta.";
  `WEAK_PASSWORD` → senha fraca; `TOO_MANY_ATTEMPTS_TRY_LATER` → muitas tentativas; `INVALID_EMAIL`; rede → sem conexão.
- `sairCloud()`: sem chamada de rede; limpa sessão e `active_user_id`/`active_org_id` como hoje.

- [ ] Step 1: Testes: `criar conta entra direto`, `email já existe`, `senha errada mostra dica de primeiro acesso`,
  `esqueci a senha chama sendOobCode`, `sem rede: mensagem amigável e pendentes continuam pendentes`.
- [ ] Step 2: Rodar — falha. Step 3: Implementar. Step 4: Rodar — passa. Step 5: Commit.

### Task 5: Cópia na nuvem, perfil e conferência

**Files:**
- Modify: `js/app/09-perfil-nuvem-sincronizacao.js` (`salvarBackupCloud`, `buscarBackupCloud`, `restaurarBackupCloud`,
  `buscarPerfilCloud`, `salvarPerfil`, `renderContaNuvem` ganha "Conferir dados na nuvem"; novo `conferenciaNuvem()`)
- Modify: `css/estilo.css` (tabela da conferência, se precisar)
- Test: `testes/nuvem_firebase.js`

**Interfaces:**
- Cópia: `PUT /backups/{device}` = `{p: JSON.stringify(payload), app_version, updated_at}`; buscar = `GET /backups`
  e escolher o `updated_at` mais recente; restaurar usa `restaurarDadosBackup(JSON.parse(p), false)` como hoje.
- Perfil: `GET`/`PUT /perfil` = `{full_name, role_title, location, phone, avatar_data, updated_at}` (mesmos campos de hoje).
- `async conferenciaNuvem() -> [{store, rotulo, aparelho, nuvem}]` (contagem sem excluídos, da fazenda ativa) e janela
  com a tabela + "Tudo confere ✓" ou as diferenças. Abre sozinha após a primeira sincronização completa quando
  `meta.conferencia_pendente` (depois zera a marca).

- [ ] Step 1: Testes: `cópia na nuvem salva e restaura`, `perfil salvo volta`, `conferência bate após primeira entrada`.
- [ ] Step 2–4: falha → implementar → passa. Step 5: Commit.

### Task 6: Limpeza, documentação, versão e publicação no app de teste

**Files:**
- Modify: `js/app/01-config-conta.js`/`09` (sem sobras de Supabase), `js/app/99-iniciar.js` e
  `js/modulos/11-contabilidade.js` (comentários), `ARQUITETURA.md`, `CLAUDE.md` (publicação sem troca de chaves; nuvem =
  Firebase; manter-banco-ativo some), `testes/LEIA-ME.md`, `sw.js` (V182)
- Delete: `.github/workflows/manter-banco-ativo.yml` (Firebase não pausa; a tarefa só gera e-mails de erro)

- [ ] Step 1: `grep -rn "supabase\|sbFetch\|SUPABASE" js index.html sw.js` → nada (fora comentários históricos claros).
- [ ] Step 2: `node --check` em todos os `.js`, `python3 testes/conferir_arquivos.py`, todos os testes de `testes/` → `OK`.
- [ ] Step 3: Versão V182 em `sw.js`; commit `V182: nuvem passa para o Firebase (app de teste)`; push só no app de teste;
  conferir publicação do GitHub Pages.
- [ ] Step 4: Mensagem ao dono com o roteiro da Fase 3 (entrar com o e-mail de TESTE → Criar conta → conferência).
