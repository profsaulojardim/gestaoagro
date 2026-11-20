// Gestão do Rebanho — teste da nuvem no Firebase (V182): sessão e acesso ao banco, primeira entrada,
// sincronização, telas de conta, cópia na nuvem, perfil e conferência — com o Firebase simulado (firebase_simulado.js).
const {chromium}=require('playwright');
const {instalarFirebaseSimulado}=require('./firebase_simulado');
const PORT=process.env.PORT||'8765';
const casos=[];const caso=(nome,fn)=>casos.push({nome,fn});
const espera=ms=>new Promise(r=>setTimeout(r,ms));

async function abrirAparelho(b,fb,sessao){
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await instalarFirebaseSimulado(ctx,fb);
  if(sessao)await ctx.addInitScript(s=>localStorage.setItem('rebanho_firebase_session',JSON.stringify(s)),sessao);
  const p=await ctx.newPage();p.erros=[];p.dialogos=[];
  p.on('pageerror',e=>p.erros.push(e.message));p.on('dialog',d=>{p.dialogos.push(d.message());d.accept();});
  await p.goto(`http://localhost:${PORT}/index.html`);await p.waitForTimeout(1200);
  return p;
}

// ---------- Task 2: sessão e acesso ao banco ----------
caso('fbFetch grava e lê',async(b,fb)=>{
  const p=await abrirAparelho(b,fb,fb.contaTeste());
  const r=await p.evaluate(async()=>{await fbFetch('/perfil',{method:'PUT',body:{full_name:'Saulo'}});return fbFetch('/perfil');});
  if(!r||r.full_name!=='Saulo')throw new Error('leu '+JSON.stringify(r));
  if(fb.ler('/contas/u1/perfil/full_name')!=='Saulo')throw new Error('não gravou no banco');
});
caso('renova token',async(b,fb)=>{
  const p=await abrirAparelho(b,fb,fb.contaTeste());
  fb.expirarTokens();
  const antes=fb.chamadas.filter(c=>c.tipo==='refresh').length;
  const r=await p.evaluate(async()=>{await fbFetch('/perfil',{method:'PUT',body:{full_name:'X'}});return fbFetch('/perfil');});
  const refresh=fb.chamadas.filter(c=>c.tipo==='refresh').length-antes;
  if(!r||r.full_name!=='X')throw new Error('não funcionou após expirar');
  if(refresh!==1)throw new Error('renovações: '+refresh);
});
caso('outra conta bloqueada',async(b,fb)=>{
  fb.contaTeste('u2','b@b.com');
  const p=await abrirAparelho(b,fb,fb.contaTeste());
  const r=await p.evaluate(async()=>{const s=authSession();s.user.id='u2';saveAuthSession(s);try{await fbFetch('/perfil');return 'leu';}catch(e){return 'erro';}});
  if(r!=='erro')throw new Error('conseguiu ler dados de outra conta');
});

(async()=>{
  const b=await chromium.launch({args:['--no-proxy-server']});
  const so=process.argv[2],falhas=[];
  for(const c of casos){
    if(so&&!c.nome.includes(so))continue;
    const {criarFirebase}=require('./firebase_simulado');
    try{await c.fn(b,criarFirebase());console.log('ok   ',c.nome);}
    catch(e){falhas.push(c.nome);console.log('FALHA',c.nome,'—',e.message.split('\n')[0]);}
  }
  await b.close();
  console.log(falhas.length?'FALHOU: '+falhas.join(', '):'OK');process.exit(falhas.length?1:0);
})();
