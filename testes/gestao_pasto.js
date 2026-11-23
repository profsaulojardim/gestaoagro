// Gestão do Rebanho — teste da Gestão do Pasto (V184): os dias mostrados no cartão do pasto contam só a situação
// ATUAL (desde a última troca), não a soma de todos os períodos antigos; o histórico do pasto mostra os dois.
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8765';
(async()=>{
  const b=await chromium.launch({args:['--no-proxy-server']});
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>localStorage.setItem('rebanho_firebase_session',JSON.stringify({idToken:'x',refreshToken:'r',expiresAt:Date.now()+3600e3,user:{id:'u1',email:'t@t.com'}})));
  await ctx.route('**/*.googleapis.com/**',r=>r.abort('failed'));await ctx.route('**/*.firebaseio.com/**',r=>r.abort('failed'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(`http://localhost:${PORT}/index.html`);await p.waitForTimeout(1200);
  const R=await p.evaluate(async()=>{
    const dia=86400000,agora=Date.now();
    await put('propriedades',{id:'p1',nome:'Fazenda Garrafão'});await put('marcas',{id:'m1',sigla:'SJ'});
    await put('lotes',{id:'l1',nome:'Bezerras',propriedadeId:'p1'});await put('lotes',{id:'l2',nome:'Vacas',propriedadeId:'p1'});
    await put('animais',{id:'a1',codigo:1,sexo:'F',status:'Ativo',loteAtualId:'l1',marcaId:'m1',raca:'Nelore'});
    // Pedreira: ocupada 39 dias no passado, depois 20 dias em descanso; Estrada: com o lote l1 há 10 dias
    await put('pastos',{id:'pe',nome:'Pedreira',propriedadeId:'p1',areaHa:6.5,status:'Descanso',loteId:null,statusDesde:agora-20*dia,
      historico:[{status:'Ocupado',inicio:agora-59*dia,fim:agora-20*dia,loteId:'l2'}]});
    await put('pastos',{id:'es',nome:'Estrada',propriedadeId:'p1',areaHa:13,status:'Ocupado',loteId:'l1',statusDesde:agora-10*dia,historico:[]});
    await formTrocarPasto();
    document.getElementById('tp_lote').value='l1';document.getElementById('tp_lote').dispatchEvent(new Event('change'));
    document.getElementById('tp_pasto').value='pe';document.getElementById('tp_data').value=hoje();
    await salvarTrocaPasto();await new Promise(r=>setTimeout(r,300));
    await telaGestaoPasto();await new Promise(r=>setTimeout(r,200));
    const txt=document.getElementById('tela').innerText;
    const card=nome=>{const c=[...document.querySelectorAll('#tela .card')].find(x=>x.innerText.includes(nome));return c?c.innerText.replace(/\n/g,' | '):'';};
    const R={pedreira:card('Pedreira'),estrada:card('Estrada')};
    await verPasto('pe');R.historico=document.getElementById('tela').innerText.replace(/\n/g,' | ').slice(0,400);
    return R;
  });
  console.log(JSON.stringify(R,null,1));
  const f=[],ok=(c,t)=>{if(!c)f.push(t);};
  ok(/\b0 dia\(s\) ocupado/.test(R.pedreira)||/Entrou hoje/.test(R.pedreira),'Pedreira deve mostrar 0 dia (entrou hoje), não 39');
  ok(/\b0 dia\(s\) reservado/.test(R.estrada)||/hoje/.test(R.estrada),'Estrada entrou em descanso hoje');
  ok(/39/.test(R.historico)&&/no total/.test(R.historico),'histórico mostra o total (39 dias ocupado no total)');
  if(errs.length)f.push('erros: '+errs.join(' | '));
  console.log(f.length?'FALHOU: '+f.join(', '):'OK');await b.close();process.exit(f.length?1:0);
})();
