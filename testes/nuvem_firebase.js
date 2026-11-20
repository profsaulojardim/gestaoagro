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

// ---------- Task 3: fazenda, primeira entrada e sincronização ----------
const sincronizar=p=>p.evaluate(async()=>{const w=()=>new Promise(r=>setTimeout(r,60));while(_syncRunning)await w();await sincronizarAgora({silencioso:true});while(_syncRunning)await w();return _syncLastError||'ok';});
caso('primeira entrada envia tudo',async(b,fb)=>{
  const sessao=fb.contaTeste(),p=await abrirAparelho(b,fb,null); // ainda sem entrar na conta nova
  // aparelho que vinha do Supabase: registros "synced" da fazenda antiga org-antiga
  await p.evaluate(async s=>{saveAuthSession(s);const m=await garantirSyncMeta();m.active_org_id='org-antiga';m.legacy_claimed_org_id='org-antiga';m.active_user_id='sb-user';await putRaw('sync_meta',m);
    for(const k of [1,2,3])await putRaw('animais',{id:'a'+k,codigo:k,nome:'Vaca '+k,sexo:'F',status:'Ativo',organization_id:'org-antiga',sync_status:'synced',updated_at:'2026-11-01T10:00:00.000Z',sync_version:2});},sessao);
  const r=await sincronizar(p);if(r!=='ok')throw new Error('sync: '+r);
  if(fb.ler('/contas/u1/fazenda')!=='org-antiga')throw new Error('fazenda: '+fb.ler('/contas/u1/fazenda'));
  const man=fb.ler('/contas/u1/manifesto/animais')||{};if(Object.keys(man).length!==3)throw new Error('manifesto: '+Object.keys(man).length);
  const loc=await p.evaluate(async()=>(await getAll('animais')).map(a=>a.sync_status));
  if(loc.length!==3||loc.some(x=>x!=='synced'))throw new Error('locais: '+loc);
});
caso('chaves com ponto',async(b,fb)=>{
  const p=await abrirAparelho(b,fb,fb.contaTeste());
  await p.evaluate(async()=>{await put('animais',{id:'1700000000000-0.5',codigo:9,nome:'Antiga',sexo:'F',status:'Ativo'});});
  if(await sincronizar(p)!=='ok')throw new Error('sync falhou');
  const p2=await abrirAparelho(b,fb,fb.contaTeste());await sincronizar(p2);
  const a=await p2.evaluate(async()=>{const x=await get('animais','1700000000000-0.5');return x&&x.nome;});
  if(a!=='Antiga')throw new Error('voltou: '+a);
});
caso('payload com lista vazia',async(b,fb)=>{
  const p=await abrirAparelho(b,fb,fb.contaTeste());
  await p.evaluate(async()=>{await put('lancamentos',{id:'l1',tipo:'despesa',valor:10,animalIds:[],extra:{a:null,b:[]},data:'2026-11-01'});});
  await sincronizar(p);
  const p2=await abrirAparelho(b,fb,fb.contaTeste());await sincronizar(p2);
  const l=await p2.evaluate(async()=>{const x=await get('lancamentos','l1');return x&&JSON.stringify([x.animalIds,x.extra]);});
  if(l!=='[[],{"a":null,"b":[]}]')throw new Error('voltou: '+l);
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
