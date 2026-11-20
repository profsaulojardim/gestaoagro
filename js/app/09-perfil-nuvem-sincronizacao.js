/* Gestão do Rebanho — js/app/09-perfil-nuvem-sincronizacao.js
   Perfil, conta, sincronização com a nuvem e backup em nuvem.
   Script clássico: as funções e variáveis de nível superior são globais e compartilhadas
   com os demais arquivos. A ordem de carregamento está no index.html. */

/* ======================= PERFIL (V163) =======================
   Aberto pela foto do usuário no topo (não fica mais no menu de baixo). Seções:
   cabeçalho do perfil · Propriedades · Marcas / donos · Conta e nuvem · Cópia em arquivo · Aplicativo.
   Os cadastros de propriedade e marca ficam aqui (o antigo botão "+" do topo saiu). */
function abrirPerfil(){
  aba="perfil";
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("ativo"));
  renderSeguro();
}
// Foto (ou iniciais) do usuário no canto do topo; lê só o perfil guardado no aparelho.
async function atualizarAvatarTopo(){
  const el=document.getElementById("topoAvatar");if(!el)return;
  let p=null;try{p=await get("perfil","perfil");}catch(_){}
  const user=await authUser();
  el.innerHTML=avatarHTML(p&&p.foto,(p&&p.nome)||(user&&user.email)||"");
  el.classList.toggle("ativo",aba==="perfil");
}
async function telaPerfil(){
  topoPagina();
  const user=await authUser();
  if(!user){
    $t.innerHTML=`
      <div class="card" style="text-align:center;margin-top:10px">
        <div class="avatar" style="margin:4px auto 10px">👤</div>
        <b>Entre na sua conta</b>
        <div class="meta" style="margin:4px 0 12px">Sua conta é também o seu perfil e identifica os dados deste aparelho.</div>
        <button class="btn" style="margin:0" onclick="formLoginCloud()">Entrar / criar conta</button>
        <div class="cloud-note" style="margin-top:12px">O primeiro login precisa de internet. Depois, a sessão fica salva neste aparelho para uso offline.</div>
      </div>`;
    return;
  }
  const {propriedades,marcas,lotes,animais}=await tudo();
  const cfg=await getConfig(); const _dias=diasDesde(cfg.ultimoBackup); const _freq=cfg.lembreteDias||7;
  const p=await carregarPerfilIntegrado(user);
  const ativos=animais.filter(a=>a.status==="Ativo");
  const lotesDa=pid=>lotes.filter(l=>l.propriedadeId===pid);
  const animaisDa=pid=>{const ids=new Set(lotesDa(pid).map(l=>l.id));return ativos.filter(a=>ids.has(a.loteAtualId)).length;};
  const animaisMarca=mid=>ativos.filter(a=>a.marcaId===mid).length;
  const secao=(icone,titulo,qtd)=>`<div class="sechead pf-sec"><span class="sic" data-ico="${icone}"></span><h2>${titulo}</h2>${qtd!=null?`<span class="pf-qtd">${qtd}</span>`:""}</div>`;
  const itemProp=pr=>`<div class="card pf-item">
      <div class="pf-ic pf-ic-foto rt" onclick="verPropriedade('${pr.id}')">${pr.foto?`<img src="${esc(pr.foto)}" alt="">`:ico("casa")}</div>
      <div class="pf-txt rt" onclick="verPropriedade('${pr.id}')"><div class="ti">${esc(pr.nome)}</div>
        <div class="meta">${pr.local?`📍 ${esc(pr.local)} · `:""}${lotesDa(pr.id).length} lote(s) · ${animaisDa(pr.id)} animal(is)</div></div>
      <button class="pf-ed" onclick="formPropriedade('${pr.id}')" aria-label="Editar propriedade">${ico("lapis")}</button></div>`;
  const itemMarca=m=>`<div class="card pf-item">
      <div class="pf-ic"><span class="pf-sigla">${esc(m.sigla||"?")}</span></div>
      <div class="pf-txt"><div class="ti">${esc(m.nome||m.sigla)}</div><div class="meta">Sigla ${esc(m.sigla||"—")} · ${animaisMarca(m.id)} animal(is) ativo(s)</div></div>
      <button class="pf-ed" onclick="formMarca('${m.id}')" aria-label="Editar marca">${ico("lapis")}</button></div>`;
  $t.innerHTML=`
    <div class="card pf-cab">
      <div class="avatar-wrap" onclick="formPerfil()">
        <div class="avatar">${avatarHTML(p.foto,p.nome||user.email||"Usuário")}</div><div class="avatar-cam">📷</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="ti" style="font-size:19px">${esc(p.nome||"Usuário")}</div>
        ${p.funcao?`<div class="meta">${esc(p.funcao)}</div>`:""}
        <div class="meta" style="overflow-wrap:anywhere">✉️ ${esc(user.email||"")}</div>
        ${p.localizacao?`<div class="meta">📍 ${esc(p.localizacao)}</div>`:""}
        ${p.telefone?`<div class="meta">📞 ${esc(p.telefone)}</div>`:""}
      </div>
      <button class="pf-ed" onclick="formPerfil()" aria-label="Editar perfil">${ico("lapis")}</button>
    </div>
    <div class="pf-resumo">${propriedades.length} propriedade(s) · ${lotes.length} lote(s) · ${ativos.length} animal(is) ativo(s)</div>

    ${secao("casa","Propriedades",propriedades.length)}
    ${propriedades.map(itemProp).join("")||`<div class="meta pf-vazio">Nenhuma propriedade cadastrada.</div>`}
    <button class="btn btn-sec" onclick="formPropriedade()">+ Nova propriedade</button>

    ${secao("ferro","Marcas / donos",marcas.length)}
    ${marcas.map(itemMarca).join("")||`<div class="meta pf-vazio">Nenhuma marca cadastrada. A marca identifica o dono de cada animal.</div>`}
    <button class="btn btn-sec" onclick="formMarca()">+ Nova marca / dono</button>

    ${secao("nuvem","Conta e nuvem")}
    <div id="cloudAccountBox"><div class="cloud-card"><div class="meta">Verificando sua conta…</div></div></div>

    ${secao("doc","Cópia em arquivo")}
    <div class="card">
      <div class="meta">Cópia extra de segurança (.json) para guardar fora do app ou levar para outro aparelho.</div>
      <div class="meta" style="margin-top:6px"><b>${cfg.ultimoBackup?`Última cópia: há ${_dias} dia(s).`:"Nenhuma cópia em arquivo salva ainda."}</b></div>
      <div class="lado" style="margin-top:12px">
        <button class="btn btn-sec" onclick="exportar()">⬇ Baixar cópia</button>
        <button class="btn btn-sec" onclick="document.getElementById('pf_importar').click()">⬆ Importar cópia</button>
      </div>
      <input type="file" id="pf_importar" accept="application/json" onchange="importar(this)" style="display:none">
      <label>Lembrar de fazer a cópia a cada</label>
      <select onchange="salvarFreq(this.value)">
        <option value="3" ${_freq===3?"selected":""}>3 dias</option>
        <option value="7" ${_freq===7?"selected":""}>7 dias</option>
        <option value="15" ${_freq===15?"selected":""}>15 dias</option>
        <option value="30" ${_freq===30?"selected":""}>30 dias</option></select>
    </div>

    ${secao("engr","Aplicativo")}
    <div class="card pf-lista">
      <div class="sheet-item rt" onclick="telaInstalar()"><span class="si" data-ico="celular"></span>${appInstalado()?"App instalado · compartilhar link":"Instalar o app no celular"}<span class="pf-chev">›</span></div>
      <div class="sheet-item rt" onclick="gerenciarDadosV116()"><span class="si" data-ico="engr"></span>Gerenciar dados e reiniciar<span class="pf-chev">›</span></div>
      <div class="sheet-item rt" onclick="sobreApp()"><span class="si" data-ico="info"></span>Sobre o app<span class="pf-chev">›</span></div>
    </div>
    <div class="pf-versao">${window.APP_VERSAO?`Versão ${esc(window.APP_VERSAO)}`:""}</div>`;
  renderContaNuvem();
}

/* ---------- Conta na nuvem (Firebase) / backup em nuvem ---------- */
async function renderContaNuvem(){
  const box=document.getElementById("cloudAccountBox"); if(!box)return;
  const user=await authUser();
  if(!user){box.innerHTML="";return;}
  let ultimo="";
  try{
    const b=await buscarBackupCloud(false);
    if(b&&b.updated_at)ultimo=`Última cópia de segurança na nuvem: ${new Date(b.updated_at).toLocaleString('pt-BR')}`;
  }catch(e){}
  box.innerHTML=`<div class="cloud-card">
    <div class="row"><div style="min-width:0"><div class="ti">Conta conectada</div>
      <div class="meta" style="overflow-wrap:anywhere">${esc(user.email||"Usuário")}</div></div>
      <span class="cloud-status on">Conectado</span></div>
    ${ultimo?`<div class="meta" style="margin-top:8px">${esc(ultimo)}</div>`:""}
    <div id="syncStatusBox" style="margin-top:10px"></div>
    <button class="btn" style="margin-top:10px" onclick="sincronizarAgora()">↻ Sincronizar agora</button>
    <div class="cloud-grid">
      <button class="btn btn-sec" onclick="salvarBackupCloud()">☁️ Criar cópia de segurança</button>
      <button class="btn btn-sec btn-recuperar" onclick="restaurarBackupCloud()">↥ Recuperar cópia anterior</button>
      <div class="nota-recuperar">⚠️ <strong>A recuperação substitui os dados deste aparelho.</strong></div>
    </div>
    <div class="cloud-note">A sincronização mantém os dados iguais entre aparelhos. A cópia de segurança é uma proteção a mais para recuperar dados.</div>
    <button class="btn-fant" style="margin-top:8px" onclick="mostrarConferencia(null)">🔎 Conferir dados na nuvem</button>
    <button class="btn btn-perigo" style="margin-top:14px;margin-bottom:0" onclick="confirmarLogout()">Sair da conta</button>
  </div>`;
  atualizarStatusSyncUI();
}

/* ---------- Propriedades e marcas (cadastros do Perfil) ---------- */
async function formPropriedade(id){
  const pr=id?await get("propriedades",id):null;
  abrir(`<h2>${pr?"Editar propriedade":"Nova propriedade"}</h2>
    <label>Nome *</label><input id="p_nome" value="${esc(pr?pr.nome:"")}" placeholder="Ex: Fazenda Garrafão">
    <label>Localização</label><input id="p_local" value="${esc(pr&&pr.local||"")}" placeholder="Ex: Garrafão - Campos RJ">
    <div class="lado" style="margin-top:18px"><button class="btn btn-sec" onclick="fechar()">Cancelar</button>
      <button class="btn" onclick="salvarPropriedade(${pr?`'${pr.id}'`:""})">Salvar</button></div>
    ${pr?`<button class="btn-fant" style="margin-top:8px;color:var(--perigo)" onclick="apagarPropriedade('${pr.id}')">Apagar propriedade</button>`:""}`);
}
async function salvarPropriedade(id){
  const n=val("p_nome");if(!n)return alert("Dê um nome.");
  const pr=id?await get("propriedades",id):{id:uid(),criadoEm:Date.now()};
  pr.nome=n;pr.local=val("p_local");
  await put("propriedades",pr);fechar();recarregarTelaAtual();
}
async function apagarPropriedade(id){
  const ls=(await getAll("lotes")).filter(l=>l.propriedadeId===id);
  if(ls.length)return alert("Apague ou mude de propriedade os lotes desta propriedade antes.");
  if(!confirm("Apagar esta propriedade?"))return;
  await del("propriedades",id);fechar();abrirPerfil();
}
async function formMarca(id){
  if(!(await podeUsarApp("Gerenciar marcas / donos")))return;
  const m=id?await get("marcas",id):null;
  abrir(`<h2>${m?"Editar marca / dono":"Nova marca / dono"}</h2>
    <label>Sigla da marca *</label><input id="m_sig" value="${esc(m?m.sigla:"")}" placeholder="Ex: SJ">
    <label>Nome do dono</label><input id="m_nome" value="${esc(m&&m.nome||"")}" placeholder="Ex: Saulo Jardim">
    <div class="lado" style="margin-top:18px"><button class="btn btn-sec" onclick="fechar()">Cancelar</button>
      <button class="btn" onclick="salvarMarca(${m?`'${m.id}'`:""})">Salvar</button></div>
    ${m?`<button class="btn-fant" style="margin-top:8px;color:var(--perigo)" onclick="apagarMarca('${m.id}')">Apagar marca</button>`:""}`);
}
async function salvarMarca(id){
  const s=val("m_sig");if(!s)return alert("Informe a sigla.");
  const m=id?await get("marcas",id):{id:uid()};
  m.sigla=s;m.nome=val("m_nome");
  await put("marcas",m);fechar();recarregarTelaAtual();
}
async function apagarMarca(id){
  const usam=(await getAll("animais")).filter(a=>a.marcaId===id).length;
  if(usam)return alert(`${usam} animal(is) usam esta marca. Troque a marca deles antes de apagar.`);
  if(!confirm("Apagar esta marca?"))return;
  await del("marcas",id);fechar();recarregarTelaAtual();
}

function formLoginCloud(){
  abrir(`<h2>Conta do Rebanho</h2>
    <div class="meta">Escolha como deseja continuar.</div>

    <button class="btn" style="margin-top:18px" onclick="formEntrarCloud()">Entrar</button>
    <button class="btn btn-sec" onclick="formCriarContaCloud()">Criar conta</button>

    <button class="btn-fant" onclick="fechar()">Cancelar</button>`);
}

function formEntrarCloud(msg=""){
  abrir(`<h2>Entrar</h2>
    ${msg?`<div class="card" style="background:#f3faf5;border-left:4px solid var(--verde);box-shadow:none;margin-bottom:14px">
      <b style="color:var(--verde-esc)">✅ Cadastro realizado com sucesso</b>
      <div class="meta" style="margin-top:4px">${esc(msg)}</div>
    </div>`:`<div class="meta">Use o e-mail e a senha da sua conta.</div>`}
    <div class="card" style="background:#fff8e6;border-left:4px solid #c9a227;box-shadow:none;margin:12px 0 4px">
      <b>Nova nuvem (V182)</b>
      <div class="meta" style="margin-top:4px">No primeiro acesso depois da atualização, toque em <b>Criar conta</b> com o mesmo e-mail e uma senha nova. Seus dados do aparelho são enviados para a nuvem nova.</div>
    </div>

    <label>E-mail</label>
    <input id="cl_email" type="email" autocomplete="email" placeholder="seu@email.com">

    <label>Senha</label>
    <input id="cl_senha" type="password" autocomplete="current-password" placeholder="Sua senha">

    <div id="cl_msg" class="meta" style="margin-top:10px"></div>

    <button class="btn" style="margin-top:18px" onclick="entrarCloud()">Entrar</button>
    <button class="btn btn-sec" onclick="formCriarContaCloud()">Criar conta</button>
    <button class="btn-fant" onclick="esqueciSenhaCloud()">Esqueci a senha</button>
    <button class="btn-fant" onclick="formLoginCloud()">‹ Voltar</button>`);
}

function formCriarContaCloud(){
  abrir(`<h2>Criar conta</h2>
    <div class="meta">Crie sua conta para identificar e proteger os dados do rebanho.</div>

    <label>Nome *</label>
    <input id="cl_nome" autocomplete="name" placeholder="Seu nome">

    <label>E-mail *</label>
    <input id="cl_email" type="email" autocomplete="email" placeholder="seu@email.com">

    <label>Senha *</label>
    <input id="cl_senha" type="password" autocomplete="new-password" placeholder="Crie uma senha">

    <label>Confirmar senha *</label>
    <input id="cl_senha2" type="password" autocomplete="new-password" placeholder="Repita a senha">

    <div id="cl_msg" class="meta" style="margin-top:10px"></div>

    <button class="btn" style="margin-top:18px" onclick="criarContaCloud()">Criar conta</button>
    <button class="btn btn-sec" onclick="formEntrarCloud()">Já tenho conta</button>
    <button class="btn-fant" onclick="formLoginCloud()">‹ Voltar</button>`);
}
/* Mensagens do Firebase Auth em português (V182) e proteção contra toque duplo nos botões de conta (V154) */
let _authOcupado=false;
function traduzirErroAuth(msg){
  const m=String(msg||"");
  if(/EMAIL_EXISTS/.test(m))return "Este e-mail já tem conta nesta nuvem. Use Entrar (ou Esqueci a senha).";
  if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m))return "E-mail ou senha incorretos. Primeiro acesso na nuvem nova? Use Criar conta com o mesmo e-mail.";
  if(/USER_DISABLED/.test(m))return "Esta conta foi desativada.";
  if(/TOO_MANY_ATTEMPTS/.test(m))return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if(/WEAK_PASSWORD/.test(m))return "Senha fraca: use pelo menos 8 caracteres, misturando letras e números.";
  if(/INVALID_EMAIL|MISSING_EMAIL/.test(m))return "E-mail inválido. Confira o endereço digitado.";
  if(/Sem conexão|Failed to fetch|NetworkError|Load failed/i.test(m))return MSG_SEM_CONEXAO;
  return m||"Não foi possível concluir. Tente de novo.";
}
function travarBotoesConta(on){
  document.querySelectorAll("#md .btn,#md .btn-fant").forEach(b=>{b.disabled=on;b.style.opacity=on?".55":"";});
}
function cloudMsg(t,erro=false){
  const el=document.getElementById("cl_msg"); if(el){el.textContent=t;el.style.color=erro?"var(--perigo)":"var(--muted)";}
}
async function entrarCloud(){
  if(_authOcupado)return;
  const email=val("cl_email").trim(),password=val("cl_senha");
  if(!email||!password)return cloudMsg("Informe e-mail e senha.",true);
  cloudMsg("Entrando…");
  _authOcupado=true;travarBotoesConta(true);
  try{
    saveAuthSession(sessaoDeRespostaAuth(await fbAuth("signInWithPassword",{email,password,returnSecureToken:true})));
    await prepararContaLocal();
    await sincronizarPerfilCloud();
    await sincronizarAgora({silencioso:true});
    fechar(); await irAba("inicio");
    await mostrarConferenciaSePendente();
  }catch(e){
    cloudMsg(traduzirErroAuth(e.message||"Erro ao entrar."),true);
  }finally{_authOcupado=false;travarBotoesConta(false);}
}
// V182: no Firebase a conta já entra na hora (não precisa confirmar e-mail).
async function criarContaCloud(){
  const nome=val("cl_nome").trim(),email=val("cl_email").trim(),password=val("cl_senha"),password2=val("cl_senha2");
  if(!nome)return cloudMsg("Informe seu nome para criar a conta.",true);
  if(!email)return cloudMsg("Informe seu e-mail.",true);
  if(!password)return cloudMsg("Crie uma senha.",true);
  if(password.length<8)return cloudMsg("A senha deve ter pelo menos 8 caracteres.",true);
  if(password!==password2)return cloudMsg("As senhas não coincidem.",true);
  if(_authOcupado)return;
  cloudMsg("Criando conta…");
  _authOcupado=true;travarBotoesConta(true);
  try{
    saveAuthSession(sessaoDeRespostaAuth(await fbAuth("signUp",{email,password,returnSecureToken:true}),nome));
    const atual=(await fbFetch("/perfil"))||{};
    await fbFetch("/perfil",{method:"PUT",body:{...atual,full_name:atual.full_name||nome,updated_at:agoraISO()}});
    await prepararContaLocal();
    await sincronizarPerfilCloud();
    await sincronizarAgora({silencioso:true});
    fechar(); await irAba("inicio");
    await mostrarConferenciaSePendente();
  }catch(e){cloudMsg(traduzirErroAuth(e.message||"Erro ao criar conta."),true);}
  finally{_authOcupado=false;travarBotoesConta(false);}
}
async function esqueciSenhaCloud(){
  const email=(val("cl_email")||"").trim();
  if(!email)return cloudMsg("Digite seu e-mail acima e toque de novo em Esqueci a senha.",true);
  if(_authOcupado)return;
  _authOcupado=true;travarBotoesConta(true);
  try{
    await fbAuth("sendOobCode",{requestType:"PASSWORD_RESET",email});
    cloudMsg(`Enviamos um link para ${email} para você criar uma senha nova. Veja também a caixa de spam.`);
  }catch(e){
    cloudMsg(/EMAIL_NOT_FOUND/.test(e.message)?"Esse e-mail ainda não tem conta na nuvem nova. Use Criar conta.":traduzirErroAuth(e.message),true);
  }finally{_authOcupado=false;travarBotoesConta(false);}
}
function confirmarLogout(){
  if(!confirm("Deseja realmente sair da sua conta?"))return;
  sairCloud();
}
async function sairCloud(){
  saveAuthSession(null); // V182: no Firebase basta esquecer a sessão neste aparelho
  const m=await garantirSyncMeta();
  m.active_user_id=null;
  m.active_org_id=null;
  m.nuvem_alterado_em=null;
  await putRaw("sync_meta",m);
  aba="inicio";
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("ativo",x.dataset.aba==="inicio"));
  telaBloqueada();
}
/* Fazenda da conta (V182): /contas/{uid}/fazenda guarda o identificador que os registros do aparelho já usam
   em organization_id (o da época do Supabase), para nenhum dado local precisar mudar. Na primeira vez, grava. */
async function cloudOrgId(){
  const u=await authUser(); if(!u)throw new Error("Entre na sua conta primeiro.");
  let org=await fbFetch("/fazenda");
  if(!org){
    const meta=await garantirSyncMeta();
    org=meta.active_org_id||meta.legacy_claimed_org_id||u.id;
    await fbFetch("/fazenda",{method:"PUT",body:org});
  }
  return org;
}
async function cloudDeviceId(){
  const m=await garantirSyncMeta(); return m.device_id;
}

async function prepararContaLocal(){
  const user=await authUser(); if(!user)return null;
  const meta=await garantirSyncMeta();

  // Offline: mantém a fazenda previamente associada ao aparelho.
  if(!navigator.onLine){
    if(meta.active_user_id===user.id&&meta.active_org_id)return meta.active_org_id;
    return null;
  }

  const orgAnterior=meta.active_org_id||meta.legacy_claimed_org_id||null;
  const org=await cloudOrgId();

  // V182: primeira entrada deste aparelho nesta conta do Firebase — tudo o que está no aparelho (da fazenda
  // anterior ou sem fazenda) passa para a fazenda da conta e fica pendente, para subir para a nuvem nova.
  // Registros de outra fazenda que estejam no aparelho não são tocados.
  if(meta.firebase_uid!==user.id){
    for(const s of SYNC_STORES){
      for(const o of await getAllRaw(s)){
        if(o.organization_id&&o.organization_id!==org&&o.organization_id!==orgAnterior)continue;
        o.organization_id=org;
        o.sync_status=o.sync_status&&o.sync_status!=="pending_create"?"pending_update":"pending_create";
        await putRaw(s,o);
      }
    }
    meta.firebase_uid=user.id;
    meta.nuvem_alterado_em=null; // conta nova neste aparelho: o próximo pull baixa tudo
    meta.legacy_claimed_org_id=org;
    meta.conferencia_pendente=true;
  }
  meta.active_user_id=user.id;
  meta.active_org_id=org;
  await putRaw("sync_meta",meta);
  return org;
}

function payloadSync(o){
  const p={...o};
  delete p.sync_status;
  return p;
}
function cloudRecordToLocal(row){
  const p={...(row.payload||{})};
  p.id=p.id||row.record_id;
  p.organization_id=row.organization_id;
  p.updated_at=row.record_updated_at;
  p.deleted_at=row.deleted_at||null;
  p.sync_version=Number(row.sync_version||p.sync_version||1);
  p.sync_status="synced";
  return p;
}
function cloudMaisNovo(row,local){
  if(!local)return true;
  const ct=Date.parse(row.record_updated_at||0)||0;
  const lt=Date.parse(local.updated_at||0)||0;
  if(ct!==lt)return ct>lt;
  return Number(row.sync_version||0)>=Number(local.sync_version||0);
}
// Estritamente mais novo (usado para decidir o que rebaixar): evita reaplicar
// registros idênticos e não depende do relógio do servidor.
function cloudNewerStrict(row,local){
  if(!local)return true;
  const ct=Date.parse(row.record_updated_at||0)||0;
  const lt=Date.parse(local.updated_at||0)||0;
  if(ct!==lt)return ct>lt;
  return Number(row.sync_version||0)>Number(local.sync_version||0);
}

/* ---------- Nuvem no Firebase Realtime Database (V182) ----------
   /contas/{uid}/registros/{store}/{chave} = {p: registro em texto JSON, u: updated_at, v: sync_version, d: deleted_at, dev}
   /contas/{uid}/manifesto/{store}/{chave} = {u, v, d}  (leve, sem fotos: diz o que mudou)
   O registro vai como texto JSON porque o Firebase apaga listas vazias e campos null.
   Chaves não podem ter . # $ [ ] /  — chaveFirebase() troca esses caracteres (e o %) por %XX, ida e volta exata. */
const chaveFirebase=id=>String(id).replace(/[.#$\[\]\/%]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,"0"));
const idDaChave=k=>String(k).replace(/%([0-9A-F]{2})/g,(m,h)=>String.fromCharCode(parseInt(h,16)));
const caminhoRegistro=(store,chave)=>`/registros/${store}/${encodeURIComponent(chave)}`;
// Registro da nuvem no formato de linha que cloudRecordToLocal() entende.
function linhaDaNuvem(store,chave,reg,org){
  let payload={};try{payload=JSON.parse(reg.p||"{}");}catch(e){}
  return {organization_id:org,store_name:store,record_id:idDaChave(chave),payload,
    record_updated_at:reg.u||null,deleted_at:reg.d||null,sync_version:Number(reg.v||1)};
}
const metaDoManifesto=m=>({record_updated_at:m&&m.u,sync_version:m&&m.v});

async function pushPendentes(org,user,device){
  let enviados=0,recebidos=0;
  for(const s of SYNC_STORES){
    const locais=(await getAllRaw(s)).filter(o=>o.organization_id===org&&o.sync_status!=="synced");
    if(!locais.length)continue;
    const manifesto=(await fbFetch("/manifesto/"+s))||{};
    // Lotes de 25: cada lote vai numa única gravação (registros + manifesto juntos).
    for(let i=0;i<locais.length;i+=25){
      let lote=locais.slice(i,i+25);
      // V154: se a nuvem já tem uma versão MAIS NOVA (feita em outro aparelho), ela vale: é baixada e a local
      // antiga não é enviada — um aparelho que ficou offline com edição antiga não sobrescreve a mais nova.
      const conflitos=lote.filter(o=>{const m=manifesto[chaveFirebase(o.id)];return m&&cloudNewerStrict(metaDoManifesto(m),o);});
      for(const o of conflitos){
        const k=chaveFirebase(o.id),reg=await fbFetch(caminhoRegistro(s,k));
        if(reg){await putRaw(s,cloudRecordToLocal(linhaDaNuvem(s,k,reg,org)));recebidos++;}
      }
      const baixados=new Set(conflitos.map(o=>String(o.id)));
      lote=lote.filter(o=>!baixados.has(String(o.id)));
      if(!lote.length)continue;
      const mudancas={};
      for(const o of lote){
        const k=chaveFirebase(o.id),u=o.updated_at||agoraISO(),v=Number(o.sync_version||1),d=o.deleted_at||null;
        mudancas[`registros/${s}/${k}`]={p:JSON.stringify(payloadSync(o)),u,v,d,dev:device};
        mudancas[`manifesto/${s}/${k}`]={u,v,d};
      }
      mudancas.alteradoEm={".sv":"timestamp"}; // marca "a nuvem mudou" (o pull dos outros aparelhos olha só ela)
      await fbFetch("",{method:"PATCH",body:mudancas});
      for(const o of lote){
        const atual=await getRaw(s,o.id);
        if(!atual)continue;
        // Alterado de novo enquanto enviava: continua pendente para a próxima vez.
        if((atual.updated_at||"")===(o.updated_at||"")&&Number(atual.sync_version||1)===Number(o.sync_version||1)){
          atual.sync_status="synced";await putRaw(s,atual);
        }
        enviados++;
      }
    }
  }
  return {enviados,recebidos};
}

async function pullCloud(org){
  /* Reconciliação por conteúdo (como desde a V75): para cada store, baixa o manifesto leve, compara com o local
     pelo updated_at/sync_version e só baixa o registro completo do que realmente mudou. Cobre inserções,
     edições e exclusões. Muitos registros (> 40, ex.: aparelho novo) → baixa a store inteira de uma vez. */
  let aplicados=0,consultados=0;
  // Economia de download (plano gratuito: 10 GB/mês): se a marca "alteradoEm" da nuvem é a mesma da última
  // leitura, nada mudou lá — não baixa os manifestos (a sincronização automática roda a cada 30 s).
  const marca=await fbFetch("/alteradoEm"),metaIni=await garantirSyncMeta();
  if(marca!=null&&metaIni.nuvem_alterado_em===marca)return {aplicados:0,consultados:0,cursor:metaIni.last_server_sync_at};
  for(const store of SYNC_STORES){
    const manifesto=(await fbFetch("/manifesto/"+store))||{};
    const chaves=Object.keys(manifesto);
    consultados+=chaves.length;
    const precisa=[];
    for(const k of chaves){
      const local=await getRaw(store,idDaChave(k));
      if(!local||cloudNewerStrict(metaDoManifesto(manifesto[k]),local)||(local.organization_id&&local.organization_id!==org))precisa.push(k);
    }
    if(!precisa.length)continue;
    let regs={};
    if(precisa.length>40)regs=(await fbFetch("/registros/"+store))||{};
    else for(const k of precisa)regs[k]=await fbFetch(caminhoRegistro(store,k));
    for(const k of precisa){
      if(!regs[k])continue;
      const row=linhaDaNuvem(store,k,regs[k],org),local=await getRaw(store,row.record_id);
      const localDeOutraOrg=!!(local&&local.organization_id&&local.organization_id!==org);
      // Preserva alteração local pendente que seja mais nova que a nuvem.
      if(!local||localDeOutraOrg||local.sync_status==="synced"||cloudNewerStrict(row,local)){
        await putRaw(store,cloudRecordToLocal(row));
        aplicados++;
      }
    }
  }
  const meta=await garantirSyncMeta();
  meta.last_server_sync_at=agoraISO();
  meta.nuvem_alterado_em=marca;
  await putRaw("sync_meta",meta);
  return {aplicados,consultados,cursor:meta.last_server_sync_at};
}

async function sincronizarAgora({silencioso=false}={}){
  if(_syncRunning)return _syncLastResult;
  if(!navigator.onLine){
    _syncLastError="Sem internet";
    if(!silencioso)alert("Sem internet. As alterações ficarão pendentes e serão sincronizadas quando a conexão voltar.");
    atualizarStatusSyncUI();
    return null;
  }
  const user=await authUser();
  if(!user){
    if(!silencioso)formLoginCloud();
    return null;
  }

  _syncRunning=true;_syncLastError="";
  atualizarStatusSyncUI("sincronizando");
  try{
    const org=await prepararContaLocal();
    if(!org)throw new Error("Não foi possível identificar a organização da conta.");
    const device=await cloudDeviceId();

    const push=await pushPendentes(org,user,device);
    const pull=await pullCloud(org);
    await numerarSemCodigo(); await migrarMedicamentosParaEstoque(); // V133/V142: animais antigos que chegaram de outro aparelho

    const meta=await garantirSyncMeta();
    meta.last_sync_at=agoraISO();
    meta.active_org_id=org;
    meta.active_user_id=user.id;
    await putRaw("sync_meta",meta);

    const totalAplicados=push.recebidos+pull.aplicados;
    _syncLastResult={...push,pull:pull.aplicados,consultados:pull.consultados,quando:meta.last_sync_at};
    atualizarStatusSyncUI("ok");

    // V74: atualiza automaticamente tanto a lista de grupos quanto o detalhe
    // do grupo que estiver aberto. Isso faz um novo vínculo aparecer na tela
    // assim que chegar de outro aparelho, sem fechar/reabrir o PWA.
    if(totalAplicados>0){
      const syncScreen=$t.dataset.syncScreen||"";
      if(syncScreen==="grupos")await telaGrupos();
      else if(syncScreen.startsWith("grupo:"))await verGrupo(syncScreen.slice(6));
    }

    if(!silencioso){
      alert(`Sincronização concluída.\nEnviados: ${push.enviados}\nRecebidos/aplicados: ${totalAplicados}`);
      // No Perfil, atualiza contadores/status. Nas subtelas, preserva a tela.
      if(aba==="perfil")await renderSeguro();
    }
    return _syncLastResult;
  }catch(e){
    _syncLastError=e.message||String(e);
    atualizarStatusSyncUI("erro");
    if(!silencioso)alert("Não foi possível sincronizar: "+_syncLastError);
    return null;
  }finally{
    _syncRunning=false;
  }
}

async function statusSync(){
  const meta=await garantirSyncMeta();
  let pendentes=0;
  if(meta.active_org_id){
    for(const s of SYNC_STORES){
      const arr=await getAllRaw(s);
      pendentes+=arr.filter(o=>o.organization_id===meta.active_org_id&&o.sync_status!=="synced").length;
    }
  }
  return {pendentes,last_sync_at:meta.last_sync_at,erro:_syncLastError};
}
async function atualizarStatusSyncUI(forcar=""){
  const el=document.getElementById("syncStatusBox"); if(!el)return;
  const st=await statusSync();
  if(forcar==="sincronizando"||_syncRunning){
    el.innerHTML=`<span class="cloud-status">↻ Sincronizando…</span>`;
    return;
  }
  if(forcar==="erro"||st.erro){
    el.innerHTML=`<span class="cloud-status" style="background:#fff2ee;color:var(--perigo)">⚠ Falha na sincronização</span>
      <div class="cloud-note">${esc(st.erro||"Tente novamente.")}</div>`;
    return;
  }
  const quando=st.last_sync_at?new Date(st.last_sync_at).toLocaleString("pt-BR"):"Ainda não sincronizado";
  el.innerHTML=`<span class="cloud-status ${st.pendentes===0?"on":""}">
      ${st.pendentes===0?"✓ Sincronizado":`${st.pendentes} pendente(s)`}
    </span><div class="cloud-note">${esc(quando)}</div>`;
}

let _ultimoAutoSync=0;
let _autoSyncInterval=null;
const AUTO_SYNC_INTERVAL_MS=30000;

function solicitarAutoSync(delay=350,{ignorarJanela=false}={}){
  // No iPhone não tentamos manter o app trabalhando em segundo plano.
  // Assim que ele volta a ficar visível, o visibilitychange/pageshow dispara
  // uma nova sincronização.
  if(document.visibilityState==="hidden"||!authSession()||!navigator.onLine||_syncRunning)return;
  const agora=Date.now();
  // Evita três sincronizações seguidas quando focus/pageshow/visibilitychange
  // disparam juntos ao voltar para o PWA. A sincronização periódica continua
  // livre para rodar a cada 30 s enquanto a tela estiver ativa.
  if(!ignorarJanela&&agora-_ultimoAutoSync<12000)return;
  _ultimoAutoSync=agora;
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(async()=>{
    try{
      await prepararContaLocal();
      await sincronizarAgora({silencioso:true});
      atualizarStatusSyncUI();
    }catch(e){
      _syncLastError=e.message||String(e);
      console.warn("Sincronização em segundo plano:",e);
      atualizarStatusSyncUI("erro");
    }
  },delay);
}

window.addEventListener("online",()=>solicitarAutoSync(300,{ignorarJanela:true}));
window.addEventListener("pageshow",()=>solicitarAutoSync(450));
window.addEventListener("focus",()=>solicitarAutoSync(450));
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")solicitarAutoSync(300,{ignorarJanela:true});
});

function iniciarSyncEmSegundoPlano(){
  // A sincronização jamais participa do caminho crítico de abertura da interface.
  // Faz uma primeira tentativa logo após renderizar e, enquanto o PWA estiver
  // realmente aberto/visível, consulta alterações dos outros aparelhos a cada
  // 30 segundos. O intervalo não tenta executar quando o app está oculto.
  solicitarAutoSync(350,{ignorarJanela:true});
  if(_autoSyncInterval)clearInterval(_autoSyncInterval);
  _autoSyncInterval=setInterval(()=>{
    if(document.visibilityState==="visible"&&navigator.onLine&&authSession()){
      solicitarAutoSync(0,{ignorarJanela:true});
    }
  },AUTO_SYNC_INTERVAL_MS);
}
/* ---------- Conferência aparelho × nuvem (V182) ----------
   Conta os registros (sem os excluídos) da fazenda ativa, por tipo, no aparelho e no manifesto da nuvem.
   Abre sozinha depois da primeira sincronização com a nuvem nova (meta.conferencia_pendente). */
const ROTULOS_CONFERENCIA={propriedades:"Propriedades",marcas:"Marcas",lotes:"Lotes",animais:"Animais",eventos:"Eventos do histórico",
  medicamentos:"Medicamentos (antigos)",pastos:"Pastos",avisos:"Avisos",lancamentos:"Lançamentos",grupos:"Grupos",
  grupo_animais:"Animais em grupos",insumos:"Itens do estoque",insumo_mov:"Movimentos do estoque"};
async function conferenciaNuvem(){
  const meta=await garantirSyncMeta(),org=meta.active_org_id,linhas=[];
  for(const store of SYNC_STORES){
    const aparelho=(await getAllRaw(store)).filter(o=>o.organization_id===org&&!o.deleted_at).length;
    const man=(await fbFetch("/manifesto/"+store))||{};
    const nuvem=Object.values(man).filter(m=>!m.d).length;
    linhas.push({store,rotulo:ROTULOS_CONFERENCIA[store]||store,aparelho,nuvem});
  }
  return linhas;
}
async function mostrarConferencia(linhas){
  if(!navigator.onLine)return alert("Sem internet. A conferência precisa consultar a nuvem.");
  if(!linhas)try{linhas=await conferenciaNuvem();}catch(e){return alert("Não foi possível conferir: "+traduzirErroAuth(e.message));}
  const usadas=linhas.filter(l=>l.aparelho||l.nuvem),dif=usadas.filter(l=>l.aparelho!==l.nuvem);
  abrir(`<h2>Conferência dos dados</h2>
    <div class="meta">Quantos registros há neste aparelho e quantos estão guardados na nuvem.</div>
    <table class="conf-tabela"><tr><th>Tipo</th><th>Aparelho</th><th>Nuvem</th></tr>
      ${usadas.map(l=>`<tr class="${l.aparelho===l.nuvem?"":"conf-dif"}"><td>${esc(l.rotulo)}</td><td>${l.aparelho}</td><td>${l.nuvem}</td></tr>`).join("")
        ||`<tr><td colspan="3" class="meta">Nenhum registro ainda.</td></tr>`}
    </table>
    ${dif.length?`<div class="card conf-aviso"><b>Há diferenças.</b><div class="meta" style="margin-top:4px">Toque em Sincronizar agora e confira de novo. Se o número da nuvem for maior, há registros de outro aparelho que ainda vão chegar; se for menor, há envios pendentes.</div></div>`
      :`<div class="card conf-ok"><b>Tudo confere ✓</b><div class="meta" style="margin-top:4px">Os dados deste aparelho estão guardados na nuvem.</div></div>`}
    <button class="btn" onclick="fechar()">Fechar</button>`);
}
async function mostrarConferenciaSePendente(){
  const meta=await garantirSyncMeta();
  if(!meta.conferencia_pendente||!navigator.onLine)return;
  meta.conferencia_pendente=false;await putRaw("sync_meta",meta);
  let linhas;try{linhas=await conferenciaNuvem();}catch(e){return;}
  if(linhas.some(l=>l.aparelho||l.nuvem))await mostrarConferencia(linhas); // conta nova e aparelho vazio: nada a conferir
}

/* Cópia de segurança na nuvem (V182): /contas/{uid}/backups/{aparelho} = {p: cópia em texto JSON, app_version, updated_at}.
   Uma por aparelho; "Recuperar" usa a mais recente de qualquer aparelho da conta. */
async function salvarBackupCloud(){
  if(!navigator.onLine)return alert("Sem internet. O backup local continua disponível.");
  try{
    const u=await authUser(); if(!u)return formLoginCloud();
    const device=await cloudDeviceId(),payload=await dadosBackup();
    await fbFetch("/backups/"+encodeURIComponent(chaveFirebase(device)),{method:"PUT",
      body:{p:JSON.stringify(payload),app_version:CLOUD_APP_VERSION,updated_at:agoraISO()}});
    await marcarBackup(); _lembreteOculto=true;
    alert("Backup salvo na nuvem com sucesso.");
    telaPerfil();
  }catch(e){alert("Não foi possível salvar na nuvem: "+e.message);}
}
async function buscarBackupCloud(mostrarErro=true){
  try{
    const u=await authUser(); if(!u)throw new Error("Entre na sua conta primeiro.");
    const todos=(await fbFetch("/backups"))||{};
    const [chave,b]=Object.entries(todos).sort((x,y)=>String(y[1].updated_at).localeCompare(String(x[1].updated_at)))[0]||[];
    if(!b)return null;
    return {payload:JSON.parse(b.p||"null"),updated_at:b.updated_at,device_id:idDaChave(chave),app_version:b.app_version};
  }catch(e){if(mostrarErro)alert("Não foi possível consultar a nuvem: "+e.message);return null;}
}
async function restaurarBackupCloud(){
  if(!navigator.onLine)return alert("Você precisa de internet para restaurar o backup da nuvem.");
  const b=await buscarBackupCloud(); if(!b)return alert("Nenhum backup encontrado na sua conta.");
  const quando=new Date(b.updated_at||b.created_at).toLocaleString("pt-BR");
  if(!confirm(`Restaurar o backup da nuvem de ${quando}? Isso substituirá os dados locais deste aparelho.`))return;
  try{
    await restaurarDadosBackup(b.payload,false);
    await marcarBackup();
    alert("Backup da nuvem restaurado com sucesso.");
    irAba("painel");
  }catch(e){alert("Não foi possível restaurar: "+e.message);}
}

// Perfil na nuvem (V182): /contas/{uid}/perfil = {full_name, role_title, location, phone, avatar_data, updated_at}
async function buscarPerfilCloud(){
  const u=await authUser(); if(!u)return null;
  return await fbFetch("/perfil");
}
function perfilCloudParaLocal(cp,user){
  return {
    id:"perfil",
    user_id:user.id,
    nome:(cp&&cp.full_name)||((user.user_metadata||{}).full_name)||"",
    funcao:(cp&&cp.role_title)||"",
    localizacao:(cp&&cp.location)||"",
    telefone:(cp&&cp.phone)||"",
    foto:(cp&&cp.avatar_data)||"",
    email:user.email||"",
    cloud_updated_at:(cp&&cp.updated_at)||null
  };
}
async function sincronizarPerfilCloud(){
  const user=await authUser(); if(!user)return null;
  let local=await get("perfil","perfil");
  if(!navigator.onLine){
    if(local){local.email=user.email||local.email||"";return local;}
    return perfilCloudParaLocal(null,user);
  }
  try{
    const cp=await buscarPerfilCloud();
    const p=perfilCloudParaLocal(cp,user);
    await put("perfil",p);
    return p;
  }catch(e){
    if(local){local.email=user.email||local.email||"";return local;}
    return perfilCloudParaLocal(null,user);
  }
}
async function carregarPerfilIntegrado(user){
  const local=await get("perfil","perfil");
  if(navigator.onLine){
    try{return await sincronizarPerfilCloud();}catch(e){}
  }
  if(local){
    local.email=user.email||local.email||"";
    return local;
  }
  return perfilCloudParaLocal(null,user);
}

/* ---------- Perfil do usuário ---------- */
const iniciais=nome=>((nome||"").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase()||"?");
const avatarHTML=(foto,nome)=>foto?`<img src="${foto}" alt="">`:`<span>${esc(iniciais(nome))}</span>`;
function lerFotoRedimensionada(file,cb){
  const rd=new FileReader();
  rd.onload=e=>{const img=new Image();
    img.onload=()=>{let w=img.width,h=img.height;const max=400;
      if(w>h&&w>max){h=Math.round(h*max/w);w=max;}else if(h>max){w=Math.round(w*max/h);h=max;}
      const c=document.createElement("canvas");c.width=w;c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);cb(c.toDataURL("image/jpeg",0.82));};
    img.src=e.target.result;};
  rd.readAsDataURL(file);
}
function pickFoto(input){const f=input.files[0];if(!f)return;
  lerFotoRedimensionada(f,d=>{_perfilFoto=d;document.getElementById("pf_avatar").innerHTML=`<img src="${d}" alt="">`;});}
function pickFotoAnimal(input){const f=input.files[0];if(!f)return;
  lerFotoRedimensionada(f,d=>{_animalFoto=d;const el=document.getElementById("an_avatar");if(el)el.innerHTML=`<img src="${d}" alt="">`;});}
// Miniatura do animal para listas e ficha (foto ou 🐄)
const animalThumb=(a,size)=>`<div class="an-thumb" style="width:${size}px;height:${size}px">${a.foto?`<img src="${esc(a.foto)}" alt="">`:"🐄"}</div>`;
// Amplia uma foto em tela cheia; toque em qualquer lugar fecha
function ampliarFoto(src){
  if(!src)return;
  const d=document.createElement("div");
  d.className="lightbox";
  const img=document.createElement("img");img.src=src;
  d.appendChild(img);
  const x=document.createElement("div");x.className="lb-x";x.textContent="✕";
  d.appendChild(x);
  d.onclick=()=>d.remove();
  document.body.appendChild(d);
}
async function ampliarFotoAnimal(id){const a=await get("animais",id);if(a&&a.foto)ampliarFoto(a.foto);}
async function pickFotoPropriedade(pid,input){
  const f=input.files[0];if(!f)return;
  lerFotoRedimensionada(f,async d=>{
    const p=await get("propriedades",pid);if(!p)return;
    p.foto=d;
    await put("propriedades",p);
    verPropriedade(pid);
  });
}
async function formPerfil(){
  const user=await authUser();
  if(!user)return formLoginCloud();
  const p=await carregarPerfilIntegrado(user);
  _perfilFoto=p.foto||"";
  abrir(`<h2>Editar perfil</h2>
    <div style="display:flex;justify-content:center;margin:6px 0 8px">
      <div class="avatar-wrap" onclick="document.getElementById('pf_file').click()">
        <div class="avatar" id="pf_avatar">${avatarHTML(_perfilFoto,p.nome||user.email)}</div><div class="avatar-cam">📷</div>
      </div>
    </div>
    <input type="file" id="pf_file" accept="image/*" style="display:none" onchange="pickFoto(this)">
    <label>Nome *</label><input id="pf_nome" value="${esc(p.nome||"")}">
    <label>Função na gestão</label><input id="pf_funcao" value="${esc(p.funcao||"")}" placeholder="Ex: Proprietário, Gerente, Veterinário…">
    <label>Localização</label><input id="pf_local" value="${esc(p.localizacao||"")}" placeholder="Ex: Campos - RJ">
    <label>E-mail da conta</label><input type="email" value="${esc(user.email||"")}" disabled style="background:#f4f6f4;color:var(--muted)">
    <label>Telefone</label><input id="pf_tel" type="tel" value="${esc(p.telefone||"")}" placeholder="Ex: (22) 99999-9999">
    <div class="meta" style="margin-top:8px">O e-mail pertence à sua conta. Nome, foto e demais dados formam o seu perfil.</div>
    <div class="lado" style="margin-top:18px"><button class="btn btn-sec" onclick="fechar()">Cancelar</button>
      <button class="btn" onclick="salvarPerfil()">Salvar</button></div>`);
}
async function salvarPerfil(){
  const user=await authUser();
  if(!user)return alert("Entre na sua conta primeiro.");
  const nome=val("pf_nome");if(!nome)return alert("Informe seu nome.");
  const p=(await get("perfil","perfil"))||{id:"perfil"};
  p.id="perfil";p.user_id=user.id;p.nome=nome;p.funcao=val("pf_funcao");p.localizacao=val("pf_local");
  p.email=user.email||"";p.telefone=val("pf_tel");p.foto=_perfilFoto||"";
  await put("perfil",p);

  if(navigator.onLine){
    try{
      await fbFetch("/perfil",{method:"PUT",body:{
        full_name:p.nome,
        role_title:p.funcao||null,
        location:p.localizacao||null,
        phone:p.telefone||null,
        avatar_data:p.foto||null,
        updated_at:agoraISO()
      }});
    }catch(e){
      alert("Perfil salvo neste aparelho, mas não foi possível atualizar a nuvem agora: "+e.message);
      fechar();telaPerfil();return;
    }
  }
  fechar();atualizarAvatarTopo();telaPerfil();
}
