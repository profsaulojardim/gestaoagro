/* Gestão do Rebanho — js/app/01-config-conta.js
   Configuração do Firebase (nuvem), sessão da conta e permissões de uso.
   Script clássico: as funções e variáveis de nível superior são globais e compartilhadas
   com os demais arquivos. A ordem de carregamento está no index.html. */

/* ======================= CONTA E NUVEM (Firebase, V182) =======================
   Login pelo Firebase Auth (REST) e dados no Firebase Realtime Database (REST), sem biblioteca.
   A apiKey do app web é pública (vai em qualquer app publicado); a proteção dos dados é feita pelas regras do
   banco: cada conta só lê e grava em /contas/{uid}. App de teste e app em uso usam o MESMO projeto: no app de
   teste entra-se com outro e-mail (ver ARQUITETURA.md). */
const FIREBASE_CONFIG={
  apiKey:"AIzaSyCiIE3LgZbyUcUbkYzcTuCDw1a2mPnXHfE",
  authDomain:"rebanho-2026.firebaseapp.com",
  databaseURL:"https://rebanho-2026-default-rtdb.firebaseio.com",
  projectId:"rebanho-2026"
};
const CLOUD_APP_VERSION="182";
const AUTH_STORAGE_KEY="rebanho_firebase_session";
const MSG_SEM_CONEXAO="Sem conexão com o servidor. Verifique a internet e tente de novo.";

// Sessão: {idToken, refreshToken, expiresAt (ms), user:{id, email, user_metadata:{full_name}}}
function authSession(){
  try{return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||"null");}catch(e){return null;}
}
function saveAuthSession(s){
  if(s)localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(s));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}
function sessaoDeRespostaAuth(b,nome){
  return {idToken:b.idToken,refreshToken:b.refreshToken,expiresAt:Date.now()+(Number(b.expiresIn)||3600)*1000,
    user:{id:b.localId,email:b.email||"",user_metadata:{full_name:nome||b.displayName||""}}};
}
// Chama o Firebase Auth: "signUp", "signInWithPassword" ou "sendOobCode". Erro = código do Firebase (ex.: EMAIL_EXISTS).
async function fbAuth(acao,corpo){
  let res;
  try{
    res=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${acao}?key=${FIREBASE_CONFIG.apiKey}`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(corpo),cache:"no-store"});
  }catch(e){throw new Error(MSG_SEM_CONEXAO);}
  const b=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error((b.error&&b.error.message)||("HTTP "+res.status));
  return b;
}
async function refreshAuthSession(){
  const s=authSession(); if(!s||!s.refreshToken)return false;
  try{
    const res=await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,{
      method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},cache:"no-store",
      body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(s.refreshToken)});
    if(!res.ok){if(res.status===400)saveAuthSession(null);return false;} // refresh inválido: precisa entrar de novo
    const n=await res.json();
    saveAuthSession({...s,idToken:n.id_token,refreshToken:n.refresh_token,expiresAt:Date.now()+(Number(n.expires_in)||3600)*1000});
    return true;
  }catch(e){return false;}
}
/* Acesso ao Realtime Database dentro da conta: fbFetch("/perfil"), fbFetch("/registros/animais",{method:"PATCH",body}).
   Renova o token se faltar menos de 1 min (ou se o banco responder 401) e repete a chamada uma vez. */
async function fbFetch(caminho,opt={}){
  let s=authSession();
  if(!s||!s.user||!s.user.id)throw new Error("Entre na sua conta primeiro.");
  if(!s.expiresAt||s.expiresAt-Date.now()<60000){await refreshAuthSession();s=authSession()||s;}
  const q=new URLSearchParams(Object.assign({auth:s.idToken},opt.query||{}));
  const url=`${FIREBASE_CONFIG.databaseURL}/contas/${encodeURIComponent(s.user.id)}${caminho||""}.json?${q}`;
  let res;
  try{
    res=await fetch(url,{method:opt.method||"GET",cache:"no-store",
      headers:opt.body!==undefined?{"Content-Type":"application/json"}:{},
      body:opt.body!==undefined?JSON.stringify(opt.body):undefined});
  }catch(e){throw new Error(MSG_SEM_CONEXAO);}
  if(res.status===401&&!opt._repetiu&&await refreshAuthSession())return fbFetch(caminho,{...opt,_repetiu:true});
  const b=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(res.status===401?"Sessão expirada ou sem permissão. Entre na sua conta de novo.":((b&&b.error)||("HTTP "+res.status)));
  return b;
}
async function authUser(){
  const s=authSession();
  return s&&s.user&&s.user.id?s.user:null;
}

function sessaoLocalValida(){
  const s=authSession();
  return !!(s&&s.user&&s.user.id);
}
async function exigirConta(acao){
  const user=await authUser();
  if(user)return user;
  const offline=!navigator.onLine;
  abrir(`<h2>Entre na sua conta</h2>
    <div class="meta">${offline
      ?"Este aparelho ainda não possui uma sessão autenticada salva. Conecte-se à internet para entrar pela primeira vez."
      :"Para usar o Gestão do Rebanho, entre ou crie sua conta."}</div>
    ${acao?`<div class="meta" style="margin-top:8px">Ação: <b>${esc(acao)}</b></div>`:""}
    <button class="btn" style="margin-top:16px" onclick="fechar();formLoginCloud()">Entrar / criar conta</button>
    <button class="btn-fant" onclick="fechar()">Cancelar</button>`);
  return null;
}
async function podeUsarApp(acao){
  return !!(await exigirConta(acao));
}
