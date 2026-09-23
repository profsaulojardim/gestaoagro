/* V113 — filtros financeiros por natureza + estoque em seções recolhidas. */
(()=>{
  const natDe=l=>{
    if(l&&['receita','custo','despesa','investimento'].includes(l.natureza))return l.natureza;
    if(l&&l.tipo==='receita')return 'receita';
    if(l&&l.tipo==='investimento')return 'investimento';
    if(l&&l.classe==='custo')return 'custo';
    return 'despesa';
  };
  const NAT={
    receita:{label:'Receita',plural:'Receitas',icon:'🟢',cor:'var(--verde)'},
    custo:{label:'Custo de produção',plural:'Custos',icon:'🟠',cor:'#c77700'},
    despesa:{label:'Despesa',plural:'Despesas',icon:'🔴',cor:'var(--perigo)'},
    investimento:{label:'Investimento',plural:'Investimentos',icon:'🔵',cor:'#3478b8'}
  };
  if(!document.getElementById('ui113-css')){
    const s=document.createElement('style');s.id='ui113-css';s.textContent=`
      .fin113-filtros{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 10px;margin-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.fin113-filtros::-webkit-scrollbar{display:none}.fin113-chip{flex:0 0 auto;padding:7px 13px;border:1.5px solid var(--linha);border-radius:22px;background:#fff;color:var(--muted);font:inherit;font-size:13px;font-weight:700}.fin113-chip.on{border-color:var(--verde);color:var(--verde);background:#f8fcf9}.est113-sec{background:#fff;border:1px solid var(--linha);border-radius:16px;margin:12px 0;overflow:hidden;box-shadow:var(--sombra)}.est113-head{width:100%;border:0;background:#fff;padding:16px;display:flex;align-items:center;gap:12px;text-align:left;font:inherit;color:var(--texto)}.est113-ico{font-size:25px}.est113-txt{flex:1;min-width:0}.est113-txt strong{display:block;font-size:17px;color:var(--verde-esc)}.est113-txt small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}.est113-chev{font-size:24px;color:var(--verde);transition:transform .15s}.est113-sec.aberta .est113-chev{transform:rotate(90deg)}.est113-body{display:none;padding:0 14px 14px}.est113-sec.aberta .est113-body{display:block}.est113-body>.btn{margin-top:0}`;document.head.appendChild(s);
  }

  window.finLancamentos=async function(){
    if(!(await podeUsarApp('Acessar lançamentos financeiros')))return;
    topoPagina();
    const {propriedades}=await tudo();
    const nomeProp=id=>(propriedades.find(p=>p.id===id)||{}).nome||'';
    let lancs=await getAll('lancamentos');
    if(_finProp)lancs=lancs.filter(l=>l.propriedadeId===_finProp);
    if(_finFiltro!=='todos')lancs=lancs.filter(l=>natDe(l)===_finFiltro);
    lancs.sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.criadoEm||0)-(a.criadoEm||0));
    const chip=(k,l)=>`<button class="fin113-chip ${_finFiltro===k?'on':''}" onclick="_finFiltro='${k}';finLancamentos()">${l}</button>`;
    const itens=lancs.map(l=>{
      const n=natDe(l),cfg=NAT[n],entrada=n==='receita',sinal=entrada?'+':'−';
      const situ=l.pago?'Pago':(entrada?'A receber':'A pagar');
      return `<div class="card"><div class="row"><div style="min-width:0"><div class="ti" style="font-size:15px">${cfg.icon} ${esc(l.categoria||cfg.label)}</div><div class="meta" style="color:${cfg.cor};font-weight:700">${cfg.label}</div></div><div style="font-weight:800;color:${cfg.cor};white-space:nowrap">${sinal} ${moeda(l.valor||0)}</div></div>${l.descricao?`<div class="meta">${esc(l.descricao)}</div>`:''}<div class="meta">📅 ${fmt(l.data)}${l.propriedadeId?` · ${esc(nomeProp(l.propriedadeId))}`:''} · <span style="color:${l.pago?'var(--verde)':'#b8860b'};font-weight:600">${situ}</span></div><div style="margin-top:6px"><button class="btn-fant" style="padding:2px 10px 2px 0;color:var(--verde);font-weight:600" onclick="toggleLancPago('${l.id}')">${l.pago?'Marcar em aberto':'Marcar pago'}</button><button class="btn-fant" style="padding:2px 8px;color:var(--verde)" onclick="formLancamento('${l.id}')">✎</button><button class="btn-fant" style="padding:2px 8px;color:var(--perigo)" onclick="excluirLancamento('${l.id}')">✕</button></div></div>`;
    });
    $t.innerHTML=`${finHead()}${finTabsBar('lancamentos')}<button class="btn" onclick="formLancamento()">+ Novo lançamento</button><div class="fin113-filtros">${chip('todos','Todos')}${chip('receita','Receitas')}${chip('custo','Custos')}${chip('despesa','Despesas')}${chip('investimento','Investimentos')}</div>${itens.length?verMais(itens,'lançamento(s)'):`<div class="vazio"><div class="big">🧾</div><b>Nenhum lançamento</b><div class="meta">Não há itens neste filtro.</div></div>`}`;
  };

  window.toggleEstoque113=id=>{const el=document.getElementById(id);if(el)el.classList.toggle('aberta');};
  window.telaEstoque=async function(){
    if(!(await podeUsarApp('Estoque de insumos')))return;
    topoPagina();
    const insumos=(await getAll('insumos')).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
    const movs=await getAll('insumo_mov');
    const valorTotal=insumos.reduce((s,i)=>s+(i.saldo||0)*(i.custoMedio||0),0);
    const aPagarIns=movs.filter(m=>m.tipo==='entrada'&&!m.pago).reduce((s,m)=>s+(m.valorTotal||0),0);
    const bloco=(gkey,gnome,gic)=>{
      const itens=insumos.filter(i=>i.grupo===gkey),valor=itens.reduce((s,i)=>s+(i.saldo||0)*(i.custoMedio||0),0);
      const linhas=itens.length?itens.map(i=>{const vv=(i.saldo||0)*(i.custoMedio||0),baixo=(i.saldo||0)<=0;return `<div class="card"><div class="row"><div class="ti" style="font-size:15px">${esc(i.nome)}</div><div style="white-space:nowrap"><button class="btn-fant" style="padding:2px 6px;color:var(--verde)" onclick="formEditarInsumo('${i.id}')">✎</button><button class="btn-fant" style="padding:2px 6px;color:var(--perigo)" onclick="excluirInsumo('${i.id}')">✕</button></div></div><div class="meta">${esc(i.categoria||'')}${i.categoria?' · ':''}Saldo: <b style="color:${baixo?'#c0392b':'var(--texto)'}">${numFmt(i.saldo)} ${esc(i.unidade||'un')}</b> · ${moeda(i.custoMedio||0)}/${esc(i.unidade||'un')} · ${moeda(vv)}</div><div style="margin-top:8px;display:flex;gap:10px"><button class="btn btn-sec" style="margin:0;flex:1" onclick="formEntradaInsumo('${i.id}')">＋ Entrada</button><button class="btn btn-sec" style="margin:0;flex:1" onclick="formConsumoInsumo('${i.id}')">－ Consumo</button></div></div>`}).join(''):`<div class="meta" style="padding:4px 2px 10px">Nenhum item cadastrado nesta seção.</div>`;
      return `<section class="est113-sec" id="est113-${gkey}"><button class="est113-head" onclick="toggleEstoque113('est113-${gkey}')"><span class="est113-ico">${gic}</span><span class="est113-txt"><strong>${gnome}</strong><small>${itens.length} item(ns) · ${moeda(valor)}</small></span><span class="est113-chev">›</span></button><div class="est113-body"><button class="btn btn-sec" onclick="formNovoInsumo('${gkey}')">+ Novo item</button>${linhas}</div></section>`;
    };
    const hist=await histEstoque(insumos,movs);
    $t.innerHTML=`<button class="voltar" onclick="telaPainel()">‹ Gestão Operacional</button><div class="sechead"><span class="sic">📦</span><h2>Estoque de Insumos</h2></div><div class="fin-cards" style="margin-bottom:10px"><div class="fin-c"><div class="cl">📦 Valor em estoque</div><div class="cv">${moeda(valorTotal)}</div></div><div class="fin-c"><div class="cl">📌 A pagar (compras)</div><div class="cv">${moeda(aPagarIns)}</div></div></div>${bloco('gado','Insumos do gado','💊')}${bloco('manutencao','Manutenção da propriedade','🔧')}<section class="est113-sec" id="est113-hist"><button class="est113-head" onclick="toggleEstoque113('est113-hist')"><span class="est113-ico">🧾</span><span class="est113-txt"><strong>Últimos movimentos</strong><small>${movs.length} movimento(s) registrados</small></span><span class="est113-chev">›</span></button><div class="est113-body">${hist}</div></section>`;
  };

  const custoCategoria=i=>{
    const c=(i.categoria||'').toLowerCase();
    if(i.grupo==='manutencao')return c.includes('combust')?'Máquinas / combustível':'Manutenção';
    if(c.includes('sal')||c.includes('suplement'))return 'Alimentação';
    return 'Sanidade';
  };
  window.salvarConsumoInsumo=async function(id){
    const qtd=numBR('co_qtd');if(qtd==null||qtd<=0)return alert('Informe a quantidade.');
    const it=await get('insumos',id);if(!it)return;
    if(qtd>(it.saldo||0)+1e-9)return alert('Quantidade maior que o saldo ('+numFmt(it.saldo)+' '+(it.unidade||'un')+').');
    const custoUnit=it.custoMedio||0;it.saldo=(it.saldo||0)-qtd;await put('insumos',it);
    const data=val('co_data'),obs=val('co_obs'),movId=uid();
    await put('insumo_mov',{id:movId,insumoId:id,tipo:'consumo',qtd,unidade:it.unidade||'un',custoUnit,data,obs,criadoEm:Date.now()});
    await put('lancamentos',{id:uid(),tipo:'despesa',natureza:'custo',categoria:custoCategoria(it),valor:qtd*custoUnit,classe:'custo',data,descricao:`Consumo ${it.nome} (${numFmt(qtd)} ${it.unidade||'un'})`,propriedadeId:null,pago:true,origem:'consumo_insumo',refId:movId,criadoEm:Date.now()});
    fechar();telaEstoque();
  };
})();