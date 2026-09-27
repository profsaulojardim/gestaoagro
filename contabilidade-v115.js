/* V115 — Livro Diário persistente.
   As partidas contábeis são gravadas como registros próprios dentro da store
   sincronizada `lancamentos` (tipo = "partida_contabil"). Isso mantém o histórico
   no IndexedDB + Supabase sem criar um novo store_name e sem reabrir o problema
   do CHECK sync_records_store_check.

   Regra: o evento operacional continua sendo a fonte da operação; a partida é
   materializada e permanece registrada mesmo que a tela de relatório seja fechada.
*/
(()=>{
  const rel0=window.finRelatorios;
  const formAnimal0=window.formNovoAnimal;
  const salvarAnimal0=window.salvarAnimal;
  const putOriginal=put;
  let _pcGuard=false;
  let _pcMigrando=false;

  const TIPO_PC='partida_contabil';
  const SCHEMA_PC=1;

  const dataCriacao=o=>{
    if(o&&o.dataCompra)return o.dataCompra;
    const ts=o&&(o.criadoEm||o.created_at);
    if(typeof ts==='number'&&Number.isFinite(ts))return tsData(ts);
    if(typeof ts==='string'){
      const d=new Date(ts);if(!Number.isNaN(d.getTime()))return tsData(d.getTime());
    }
    return hoje();
  };
  const formaCompra=a=>a&&a.formaPagamentoCompra==='prazo'?'Fornecedores — a pagar':'Banco/Caixa';
  const nomeAnimal=a=>`${rotulo(a)} ${codAnimal(a)}`.trim();
  const propAnimal=(a,lotes)=>{const l=lotes.find(x=>x.id===a.loteAtualId);return l?l.propriedadeId:null;};
  const chaveSegura=s=>String(s==null?'':s).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
  const idPartida=(store,refId,chave)=>`pc_${chaveSegura(store)}_${chaveSegura(refId)}_${chaveSegura(chave)}`;

  async function salvarPartida({store,refId,chave,data,descricao,debito,credito,valor,origem,propriedadeId}){
    const v=Number(valor||0);
    if(!(v>0)||!refId||!chave)return null;
    const id=idPartida(store,refId,chave);
    const existente=await getRaw('lancamentos',id);
    const agora=agoraISO();
    const registro={
      ...(existente||{}),id,tipo:TIPO_PC,schemaContabil:SCHEMA_PC,
      data:data||hoje(),descricao:descricao||origem||'Partida contábil',
      debito,credito,valor:v,origemContabil:origem||'',
      refStore:store,refId:String(refId),refChave:String(chave),
      propriedadeId:propriedadeId||null,automatico:true,
      criadoEm:existente&&existente.criadoEm?existente.criadoEm:Date.now(),
      created_at:existente&&existente.created_at?existente.created_at:agora,
      deleted_at:null
    };
    _pcGuard=true;
    try{await putOriginal('lancamentos',registro);}finally{_pcGuard=false;}
    return registro;
  }

  async function contabilizarAnimal(a,lotesArg){
    if(!a||a.deleted_at)return;
    const lotes=lotesArg||await getAll('lotes');
    const propId=propAnimal(a,lotes);
    const custo=Number(a.custoEstoque||0);
    if(!(custo>0))return;
    if(a.nascidoNaPropriedade===true){
      await salvarPartida({store:'animais',refId:a.id,chave:'nascimento',data:a.dataNascimento||dataCriacao(a),
        descricao:`Nascimento ${nomeAnimal(a)}`,debito:'Estoque de semoventes',credito:'Ganho a realizar — semoventes',
        valor:custo,origem:'Nascimento',propriedadeId:propId});
    }else{
      await salvarPartida({store:'animais',refId:a.id,chave:'compra',data:dataCriacao(a),
        descricao:`Compra ${nomeAnimal(a)}`,debito:'Estoque de semoventes',credito:formaCompra(a),
        valor:custo,origem:'Compra de animal',propriedadeId:propId});
    }
  }

  async function contabilizarLancamento(l){
    if(!l||l.deleted_at||l.tipo===TIPO_PC)return;
    const contra=l.pago?'Banco/Caixa':(l.tipo==='receita'?'Clientes — a receber':'Fornecedores — a pagar');
    if(l.tipo==='receita'){
      await salvarPartida({store:'lancamentos',refId:l.id,chave:'receita',data:l.data,descricao:l.descricao||l.categoria,
        debito:contra,credito:'Receita de vendas',valor:l.valor,origem:'Receita',propriedadeId:l.propriedadeId});
      await salvarPartida({store:'lancamentos',refId:l.id,chave:'cpv',data:l.data,descricao:`CPV · ${l.descricao||l.categoria}`,
        debito:'CPV — custo dos vendidos',credito:'Estoque de semoventes',valor:l.custo,origem:'CPV',propriedadeId:l.propriedadeId});
      await salvarPartida({store:'lancamentos',refId:l.id,chave:'ganho_realizado',data:l.data,descricao:`Realização · ${l.descricao||l.categoria}`,
        debito:'Ganho a realizar — semoventes',credito:'Ganho realizado com semoventes',valor:l.ganhoRealizado,
        origem:'Ganho realizado',propriedadeId:l.propriedadeId});
    }else if(l.tipo==='despesa'){
      const deb=l.origem==='consumo_insumo'?'Custo / despesa de insumos':(l.natureza==='custo'?'Custo de produção':'Despesas operacionais');
      const cred=l.origem==='consumo_insumo'?'Estoque de insumos':contra;
      await salvarPartida({store:'lancamentos',refId:l.id,chave:'despesa',data:l.data,descricao:l.descricao||l.categoria,
        debito:deb,credito:cred,valor:l.valor,origem:l.categoria||'Despesa',propriedadeId:l.propriedadeId});
    }else if(l.tipo==='investimento'||l.natureza==='investimento'){
      await salvarPartida({store:'lancamentos',refId:l.id,chave:'investimento',data:l.data,descricao:l.descricao||l.categoria,
        debito:'Investimentos / imobilizado',credito:contra,valor:l.valor,origem:l.categoria||'Investimento',propriedadeId:l.propriedadeId});
    }
  }

  async function contabilizarMovInsumo(m){
    if(!m||m.deleted_at||m.tipo!=='entrada'||!(Number(m.valorTotal||0)>0))return;
    const i=await get('insumos',m.insumoId);
    await salvarPartida({store:'insumo_mov',refId:m.id,chave:'compra_insumo',data:m.data,
      descricao:`Compra ${(i&&i.nome)||'insumo'}`,debito:'Estoque de insumos',
      credito:m.pago?'Banco/Caixa':'Fornecedores — a pagar',valor:m.valorTotal,origem:'Compra de insumo',propriedadeId:m.propriedadeId||null});
  }

  async function migrarHistoricoExistente(){
    if(_pcMigrando)return;
    _pcMigrando=true;
    try{
      const lotes=await getAll('lotes');
      for(const a of await getAll('animais'))await contabilizarAnimal(a,lotes);
      const lancs=(await getAll('lancamentos')).filter(l=>l.tipo!==TIPO_PC);
      for(const l of lancs)await contabilizarLancamento(l);
      for(const m of await getAll('insumo_mov'))await contabilizarMovInsumo(m);
      const cfg=(await get('perfil','config'))||{id:'config'};
      if(!cfg.migracaoContabilV115Em){cfg.migracaoContabilV115Em=Date.now();await putOriginal('perfil',cfg);}
    }catch(e){console.error('Migração contábil V115:',e);}finally{_pcMigrando=false;}
  }

  // Materializa automaticamente as partidas quando a operação é gravada.
  // Usa a store já sincronizada `lancamentos`, evitando nova whitelist no Supabase.
  put=async function(store,obj){
    const r=await putOriginal(store,obj);
    if(_pcGuard)return r;
    try{
      if(store==='animais')await contabilizarAnimal(obj);
      else if(store==='lancamentos'&&obj&&obj.tipo!==TIPO_PC)await contabilizarLancamento(obj);
      else if(store==='insumo_mov')await contabilizarMovInsumo(obj);
    }catch(e){console.error('Registro contábil automático V115:',e);}
    return r;
  };

  window.formNovoAnimal=async function(loteFixo,nascimento){
    const r=await formAnimal0.apply(this,arguments);
    if(nascimento)return r;
    const grp=document.getElementById('grp_compra');
    if(grp&&!document.getElementById('ac_forma_pagamento')){
      const box=document.createElement('div');
      box.innerHTML=`<label>Forma de pagamento</label><select id="ac_forma_pagamento"><option value="vista">À vista — Banco/Caixa</option><option value="prazo">A prazo — Fornecedores</option></select>`;
      grp.appendChild(box);
    }
    return r;
  };

  window.salvarAnimal=async function(nascimento){
    const nasceu=nascimento||((document.getElementById('a_nasceu')||{}).value==='sim');
    const forma=(document.getElementById('ac_forma_pagamento')||{}).value||'vista';
    const antes=new Set((await getAll('animais')).map(a=>a.id));
    const r=await salvarAnimal0.apply(this,arguments);
    if(nasceu)return r;
    const novo=(await getAll('animais')).filter(a=>!antes.has(a.id)).sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0))[0];
    if(novo){
      novo.formaPagamentoCompra=forma;
      novo.dataCompra=novo.dataCompra||dataCriacao(novo);
      await put('animais',novo);
    }
    return r;
  };

  async function partidasPersistidas(){
    await migrarHistoricoExistente();
    return (await getAll('lancamentos')).filter(l=>l.tipo===TIPO_PC&&!l.deleted_at)
      .sort((a,b)=>((b.data||'').localeCompare(a.data||''))||((b.criadoEm||0)-(a.criadoEm||0)));
  }

  window.finHistoricoContabil=async function(){
    if(!(await podeUsarApp('Acessar histórico contábil')))return;
    topoPagina();
    _finAno=_finAno||String(new Date().getFullYear());
    const propriedades=await getAll('propriedades');
    const itens=await partidasPersistidas();
    const nomeProp=id=>(propriedades.find(p=>p.id===id)||{}).nome||'—';
    const anos=[...new Set(itens.map(x=>(x.data||'').slice(0,4)).filter(Boolean))];
    if(!anos.includes(_finAno))anos.push(_finAno);anos.sort().reverse();
    const filtrados=itens.filter(x=>(x.data||'').slice(0,4)===_finAno&&(!_finProp||x.propriedadeId===_finProp));
    const optAno=anos.map(a=>`<option value="${a}" ${a===_finAno?'selected':''}>${a}</option>`).join('');
    const optProp=`<option value="">Todas as propriedades</option>`+propriedades.map(p=>`<option value="${p.id}" ${p.id===_finProp?'selected':''}>${esc(p.nome)}</option>`).join('');
    const cards=filtrados.map(x=>`<div class="card" style="cursor:default">
      <div class="row"><div><div class="ti" style="font-size:15px">${esc(x.descricao||'Partida contábil')}</div><div class="meta">📅 ${fmt(x.data)}${x.propriedadeId?` · ${esc(nomeProp(x.propriedadeId))}`:''}</div></div><div style="font-weight:800;white-space:nowrap">${moeda(x.valor)}</div></div>
      <div style="margin-top:9px;padding-top:9px;border-top:1px solid var(--linha);font-size:13px;line-height:1.55">
        <div><b style="color:var(--verde)">D</b> ${esc(x.debito||'—')}</div>
        <div><b style="color:var(--perigo)">C</b> ${esc(x.credito||'—')}</div>
      </div>
      ${x.origemContabil?`<div class="meta" style="margin-top:5px">${esc(x.origemContabil)}</div>`:''}
    </div>`);
    $t.innerHTML=`${finHead()}${finTabsBar('relatorios')}
      <button class="voltar" onclick="finRelatorios()">‹ Relatórios</button>
      <div class="sechead"><span class="sic">📒</span><h2>Histórico contábil</h2></div>
      <div class="meta" style="margin:-7px 4px 13px">Livro Diário persistente. Cada operação gera e grava sua partida de débito e crédito no banco sincronizado.</div>
      <div class="lado" style="margin-bottom:14px"><select onchange="_finProp=this.value;finHistoricoContabil()">${optProp}</select><select style="max-width:110px" onchange="_finAno=this.value;finHistoricoContabil()">${optAno}</select></div>
      ${cards.length?verMais(cards,'registro(s)'):`<div class="vazio"><div class="big">📒</div><b>Nenhum registro contábil</b><div class="meta">Não há partidas para os filtros selecionados.</div></div>`}`;
  };

  if(typeof rel0==='function')window.finRelatorios=async function(){
    const r=await rel0.apply(this,arguments);
    try{
      await migrarHistoricoExistente();
      const tabs=$t.querySelector('.fintabs');
      if(tabs&&!document.getElementById('btn-historico-contabil')){
        const b=document.createElement('button');
        b.id='btn-historico-contabil';b.className='btn';b.style.margin='0 0 16px';
        b.innerHTML='📒 Histórico contábil — Débitos e Créditos';
        b.onclick=()=>finHistoricoContabil();
        tabs.insertAdjacentElement('afterend',b);
      }
      const hs=[...$t.querySelectorAll('.h3')];
      const h=hs.find(e=>/Partidas do período/i.test(e.textContent||''));
      if(h){let n=h.nextElementSibling;while(n){const prox=n.nextElementSibling;n.remove();n=prox;}h.remove();}
    }catch(e){console.error('Relatórios V115:',e);}
    return r;
  };

  // Faz a migração em segundo plano assim que o banco local estiver disponível.
  const iniciarMigracao=()=>{
    if(typeof db!=='undefined'&&db){migrarHistoricoExistente();return;}
    setTimeout(iniciarMigracao,400);
  };
  setTimeout(iniciarMigracao,400);
})();