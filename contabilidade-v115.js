/* V115 — histórico contábil separado e inclusão da compra de animais nas partidas.
   Não altera a DRE: a compra de semovente continua sendo ativo (estoque), não despesa. */
(()=>{
  const rel0=window.finRelatorios;
  const formAnimal0=window.formNovoAnimal;
  const salvarAnimal0=window.salvarAnimal;

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

  function partida(data,desc,debito,credito,valor,origem,propId){
    const v=Number(valor||0);if(!(v>0))return null;
    return {data:data||'',desc,debito,credito,valor:v,origem:origem||'',propriedadeId:propId||null};
  }

  async function montarHistoricoContabil(){
    const {propriedades,lotes,animais}=await tudo();
    const lancs=await getAll('lancamentos');
    const insumos=await getAll('insumos');
    const movs=await getAll('insumo_mov');
    const out=[];

    for(const a of animais){
      if(a.nascidoNaPropriedade===true||!(Number(a.custoEstoque||0)>0))continue;
      const p=partida(dataCriacao(a),`Compra ${nomeAnimal(a)}`,'Estoque de semoventes',formaCompra(a),a.custoEstoque,'Compra de animal',propAnimal(a,lotes));
      if(p)out.push(p);
    }

    for(const a of animais){
      if(a.nascidoNaPropriedade!==true||!(Number(a.custoEstoque||0)>0))continue;
      const p=partida(a.dataNascimento,`Nascimento ${nomeAnimal(a)}`,'Estoque de semoventes','Ganho a realizar — semoventes',a.custoEstoque,'Nascimento',propAnimal(a,lotes));
      if(p)out.push(p);
    }

    for(const l of lancs){
      const contra=l.pago?'Banco/Caixa':(l.tipo==='receita'?'Clientes — a receber':'Fornecedores — a pagar');
      if(l.tipo==='receita'){
        let p=partida(l.data,l.descricao||l.categoria,contra,'Receita de vendas',l.valor,'Receita',l.propriedadeId);if(p)out.push(p);
        p=partida(l.data,`CPV · ${l.descricao||l.categoria}`,'CPV — custo dos vendidos','Estoque de semoventes',l.custo,'CPV',l.propriedadeId);if(p)out.push(p);
        p=partida(l.data,`Realização · ${l.descricao||l.categoria}`,'Ganho a realizar — semoventes','Ganho realizado com semoventes',l.ganhoRealizado,'Ganho realizado',l.propriedadeId);if(p)out.push(p);
      }else if(l.tipo==='despesa'){
        const deb=l.origem==='consumo_insumo'?'Custo / despesa de insumos':(l.natureza==='custo'?'Custo de produção':'Despesas operacionais');
        const cred=l.origem==='consumo_insumo'?'Estoque de insumos':contra;
        const p=partida(l.data,l.descricao||l.categoria,deb,cred,l.valor,l.categoria,l.propriedadeId);if(p)out.push(p);
      }else if(l.tipo==='investimento'||l.natureza==='investimento'){
        const p=partida(l.data,l.descricao||l.categoria,'Investimentos / imobilizado',contra,l.valor,l.categoria,l.propriedadeId);if(p)out.push(p);
      }
    }

    const nomeIns=id=>(insumos.find(i=>i.id===id)||{}).nome||'insumo';
    for(const m of movs){
      if(m.tipo!=='entrada')continue;
      const p=partida(m.data,`Compra ${nomeIns(m.insumoId)}`,'Estoque de insumos',m.pago?'Banco/Caixa':'Fornecedores — a pagar',m.valorTotal,'Compra de insumo',null);if(p)out.push(p);
    }

    out.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    return {itens:out,propriedades};
  }

  window.finHistoricoContabil=async function(){
    if(!(await podeUsarApp('Acessar histórico contábil')))return;
    topoPagina();
    _finAno=_finAno||String(new Date().getFullYear());
    const {itens,propriedades}=await montarHistoricoContabil();
    const nomeProp=id=>(propriedades.find(p=>p.id===id)||{}).nome||'—';
    const anos=[...new Set(itens.map(x=>(x.data||'').slice(0,4)).filter(Boolean))];
    if(!anos.includes(_finAno))anos.push(_finAno);anos.sort().reverse();
    const filtrados=itens.filter(x=>(x.data||'').slice(0,4)===_finAno&&(!_finProp||x.propriedadeId===_finProp));
    const optAno=anos.map(a=>`<option value="${a}" ${a===_finAno?'selected':''}>${a}</option>`).join('');
    const optProp=`<option value="">Todas as propriedades</option>`+propriedades.map(p=>`<option value="${p.id}" ${p.id===_finProp?'selected':''}>${esc(p.nome)}</option>`).join('');
    const cards=filtrados.map(x=>`<div class="card" style="cursor:default">
      <div class="row"><div><div class="ti" style="font-size:15px">${esc(x.desc)}</div><div class="meta">📅 ${fmt(x.data)}${x.propriedadeId?` · ${esc(nomeProp(x.propriedadeId))}`:''}</div></div><div style="font-weight:800;white-space:nowrap">${moeda(x.valor)}</div></div>
      <div style="margin-top:9px;padding-top:9px;border-top:1px solid var(--linha);font-size:13px;line-height:1.55">
        <div><b style="color:var(--verde)">D</b> ${esc(x.debito)}</div>
        <div><b style="color:var(--perigo)">C</b> ${esc(x.credito)}</div>
      </div>
      ${x.origem?`<div class="meta" style="margin-top:5px">${esc(x.origem)}</div>`:''}
    </div>`);
    $t.innerHTML=`${finHead()}${finTabsBar('relatorios')}
      <button class="voltar" onclick="finRelatorios()">‹ Relatórios</button>
      <div class="sechead"><span class="sic">📒</span><h2>Histórico contábil</h2></div>
      <div class="meta" style="margin:-7px 4px 13px">Registros em partidas dobradas. Compras de animais entram como estoque, sem virar despesa do período.</div>
      <div class="lado" style="margin-bottom:14px"><select onchange="_finProp=this.value;finHistoricoContabil()">${optProp}</select><select style="max-width:110px" onchange="_finAno=this.value;finHistoricoContabil()">${optAno}</select></div>
      ${cards.length?verMais(cards,'registro(s)'):`<div class="vazio"><div class="big">📒</div><b>Nenhum registro contábil</b><div class="meta">Não há partidas para os filtros selecionados.</div></div>`}`;
  };

  if(typeof rel0==='function')window.finRelatorios=async function(){
    const r=await rel0.apply(this,arguments);
    try{
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
    }catch(_){ }
    return r;
  };
})();