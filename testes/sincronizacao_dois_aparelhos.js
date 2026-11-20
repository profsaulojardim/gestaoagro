// Gestão do Rebanho — teste de sincronização: dois aparelhos (A e B) com a mesma conta e o Firebase simulado
// (firebase_simulado.js). Confere criação, edição offline mais antiga x mais nova, exclusão e pendências.
const {chromium}=require('playwright');
const {instalarFirebaseSimulado,criarFirebase}=require('./firebase_simulado');
const PORT=process.env.PORT||'8765';
(async()=>{
  const b=await chromium.launch({args:['--no-proxy-server']});
  const fb=criarFirebase(),sessao=fb.contaTeste('u1','t@t.com');
  const novo=async nome=>{
    const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    await instalarFirebaseSimulado(ctx,fb);
    await ctx.addInitScript(s=>localStorage.setItem('rebanho_firebase_session',JSON.stringify(s)),sessao);
    const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(nome+': '+e.message));p.on('dialog',d=>d.accept());
    await p.goto(`http://localhost:${PORT}/index.html`);await p.waitForTimeout(1500);p.ctx=ctx;return p;
  };
  const sync=p=>p.evaluate(async()=>{const w=()=>new Promise(r=>setTimeout(r,80));while(_syncRunning)await w();await sincronizarAgora({silencioso:true});while(_syncRunning)await w();return _syncLastError||'ok';});
  const nomeX=p=>p.evaluate(async()=>{const a=await get('animais','x1');return a?a.nome:'(não existe)';});
  const nuvemReg=id=>fb.ler('/contas/u1/registros/animais/'+id);
  const nuvemX=()=>{const r=nuvemReg('x1');return r?(r.d?'(excluído)':JSON.parse(r.p).nome):'(não existe)';};
  const editar=(p,nome)=>p.evaluate(async n=>{const a=await get('animais','x1');a.nome=n;await put('animais',a);},nome);
  const espera=ms=>new Promise(r=>setTimeout(r,ms));
  const R={};
  const A=await novo('A'),B=await novo('B');
  // 1) A cria, B recebe
  await A.evaluate(async()=>{await put('propriedades',{id:'p1',nome:'Fazenda'});await put('lotes',{id:'l1',nome:'L1',propriedadeId:'p1'});
    await put('animais',{id:'x1',codigo:'1',nome:'Original',sexo:'F',status:'Ativo',loteAtualId:'l1'});});
  R.s1_syncA=await sync(A);R.s1_syncB=await sync(B);R.s1=[await nomeX(A),await nomeX(B),nuvemX()];
  // 2) B edita SEM internet (mais antigo); depois A edita e sincroniza; B volta
  await B.ctx.setOffline(true);await editar(B,'Editado no B (antes)');await espera(60);
  await editar(A,'Editado no A (depois)');await sync(A);
  await B.ctx.setOffline(false);await sync(B);await sync(A);
  R.s2=[await nomeX(A),await nomeX(B),nuvemX()];
  // 3) B edita sem internet DEPOIS de A: a do B deve valer
  await editar(A,'A às 10h');await sync(A);await espera(60);
  await B.ctx.setOffline(true);await editar(B,'B às 11h (offline)');await B.ctx.setOffline(false);await sync(B);await sync(A);
  R.s3=[await nomeX(A),await nomeX(B),nuvemX()];
  // 4) B cria animais sem internet; A recebe
  await B.ctx.setOffline(true);await B.evaluate(async()=>{for(let k=0;k<3;k++)await put('animais',{id:'off'+k,codigo:String(10+k),nome:'Offline '+k,sexo:'M',status:'Ativo',loteAtualId:'l1'});});
  await B.ctx.setOffline(false);await sync(B);await sync(A);
  R.s4=await A.evaluate(async()=>(await getAll('animais')).filter(a=>a.id.startsWith('off')).length);
  // 5) A exclui; B recebe a exclusão
  await A.evaluate(async()=>{await del('animais','off0');});await sync(A);await sync(B);
  R.s5=[await B.evaluate(async()=>!!(await get('animais','off0'))),nuvemReg('off0')&&nuvemReg('off0').d?'excluído na nuvem':'ativo na nuvem'];
  // 6) B exclui sem internet algo que A editou depois: a edição mais nova deve valer
  await B.ctx.setOffline(true);await B.evaluate(async()=>{await del('animais','off1');});await espera(60);
  await A.evaluate(async()=>{const a=await get('animais','off1');a.nome='Editado depois da exclusão';await put('animais',a);});await sync(A);
  await B.ctx.setOffline(false);await sync(B);await sync(A);
  R.s6=[await A.evaluate(async()=>{const a=await get('animais','off1');return a?a.nome:'(excluído)';}),await B.evaluate(async()=>{const a=await get('animais','off1');return a?a.nome:'(excluído)';})];
  // 7) pendências: nada pendente nos dois
  const pend=p=>p.evaluate(async()=>{let n=0;for(const s of SYNC_STORES)n+=(await getAllRaw(s)).filter(o=>o.sync_status!=='synced').length;return n;});
  R.s7_pendentes=[await pend(A),await pend(B)];
  console.log(JSON.stringify(R,null,1));
  const f=[],ok=(c,t)=>{if(!c)f.push(t);};
  ok(R.s1_syncA==='ok'&&R.s1_syncB==='ok'&&R.s1.every(x=>x==='Original'),'1 criar e receber');
  ok(R.s2.every(x=>x==='Editado no A (depois)'),'2 edição antiga offline não sobrescreve');
  ok(R.s3.every(x=>x==='B às 11h (offline)'),'3 edição mais nova offline vale');
  ok(R.s4===3,'4 criados offline chegam');ok(R.s5[0]===false&&R.s5[1]==='excluído na nuvem','5 exclusão propaga');
  ok(R.s6.every(x=>x==='Editado depois da exclusão'),'6 edição mais nova vence exclusão antiga');
  ok(R.s7_pendentes.join()==='0,0','7 sem pendências');
  const erros=[...A.errs,...B.errs];if(erros.length)f.push('erros: '+erros.join(' | '));
  console.log(f.length?'FALHOU: '+f.join(', '):'OK');
  await b.close();process.exit(f.length?1:0);
})();
