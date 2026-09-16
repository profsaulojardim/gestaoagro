/* V93 — novos módulos operacionais: Saída de animais e Calculadora da Pecuária. */
(()=>{
  const css=document.createElement('style');
  css.textContent=`
    .calc-func-card{background:var(--verde-lite);border-radius:18px;padding:18px;cursor:pointer;position:relative;margin-bottom:14px;min-height:128px}
    .calc-func-card:active{background:var(--verde-lite2)}
    .calc-func-card .cfc-ico{width:50px;height:50px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:25px;box-shadow:var(--sombra);margin-bottom:12px}
    .calc-func-card .cfc-t{font-size:18px;font-weight:800;color:var(--verde-esc);padding-right:28px}
    .calc-func-card .cfc-d{font-size:13.5px;color:var(--muted);margin-top:5px;line-height:1.4;padding-right:18px}
    .calc-func-card .cfc-seta{position:absolute;right:18px;top:22px;color:var(--verde);font-size:24px}
    .calc-campos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .calc-campos .full{grid-column:1/-1}
    .calc-resultados{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
    .calc-res{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:13px}
    .calc-res.full{grid-column:1/-1}
    .calc-res .lbl{font-size:12px;color:var(--muted)}
    .calc-res .val{font-size:20px;font-weight:800;color:var(--verde-esc);margin-top:3px}
    @media(max-width:390px){.calc-campos{grid-template-columns:1fr}.calc-campos .full{grid-column:auto}}
  `;
  document.head.appendChild(css);

  function adicionarModulosPainel(){
    const heads=[...document.querySelectorAll('#tela .sechead h2')];
    const h=heads.find(x=>(x.textContent||'').trim()==='Módulos do sistema');
    if(!h)return;
    const grid=h.closest('.sechead')?.nextElementSibling;
    if(!grid||!grid.classList.contains('grid')||grid.querySelector('[data-mod-v93]'))return;
    const saida=document.createElement('div');
    saida.className='mod';saida.dataset.modV93='saida';
    saida.setAttribute('onclick','formSaida()');
    saida.innerHTML='<div class="mic">↩️</div><div class="mt">Venda / Morte de Animal</div><div class="md">Venda individual, múltipla, por lote ou grupo e registro de morte.</div><span class="chev">›</span>';
    const calc=document.createElement('div');
    calc.className='mod';calc.dataset.modV93='calc';
    calc.setAttribute('onclick','telaCalculadoraPecuaria()');
    calc.innerHTML='<div class="mic">🧮</div><div class="mt">Calculadora da Pecuária</div><div class="md">Ferramentas para cálculos de negociações e indicadores da pecuária.</div><span class="chev">›</span>';
    grid.append(saida,calc);
  }

  const painelOriginal=window.telaPainel;
  if(typeof painelOriginal==='function'){
    window.telaPainel=async function(){
      const r=await painelOriginal.apply(this,arguments);
      adicionarModulosPainel();
      return r;
    };
  }

  window.telaCalculadoraPecuaria=function(){
    topoPagina();
    if(typeof marcarNav==='function')marcarNav('painel');
    $t.dataset.syncScreen='calculadora-pecuaria';
    $t.innerHTML=`
      <button class="voltar" onclick="telaPainel()">‹ Gestão Operacional</button>
      <div class="sechead"><span class="sic">🧮</span><h2>Calculadora da Pecuária</h2></div>
      <div class="meta" style="font-size:14px;margin:0 4px 18px">Escolha o cálculo que deseja realizar.</div>
      <div class="calc-func-card" onclick="telaCalculadoraNegociacao()">
        <div class="cfc-ico">💰</div><div class="cfc-t">Valor financeiro de uma negociação</div>
        <div class="cfc-d">Calcule peso líquido, valor total da operação e peso médio por animal.</div><div class="cfc-seta">›</div>
      </div>`;
  };

  window.telaCalculadoraNegociacao=function(){
    topoPagina();
    if(typeof marcarNav==='function')marcarNav('painel');
    $t.dataset.syncScreen='calculadora-negociacao';
    $t.innerHTML=`
      <button class="voltar" onclick="telaCalculadoraPecuaria()">‹ Calculadora da Pecuária</button>
      <div class="sechead"><span class="sic">💰</span><h2>Valor da negociação</h2></div>
      <div class="card">
        <div class="calc-campos">
          <div class="full"><label>Peso bruto (kg)</label><input id="calc_peso_bruto" inputmode="decimal" placeholder="Ex: 12.500"></div>
          <div><label>Desconto por arroba</label><input id="calc_desc_arroba" inputmode="decimal" placeholder="Ex: 1"></div>
          <div><label>Tara</label><input id="calc_tara" inputmode="decimal" placeholder="Informe a tara"></div>
          <div><label>Preço da arroba (R$)</label><input id="calc_preco_arroba" inputmode="decimal" placeholder="Ex: 320"></div>
          <div><label>Quantidade de animais</label><input id="calc_qtd_animais" type="number" min="1" inputmode="numeric" placeholder="Ex: 25"></div>
        </div>
        <div class="calc-resultados">
          <div class="calc-res"><div class="lbl">Peso líquido</div><div class="val" id="calc_res_liq">—</div></div>
          <div class="calc-res"><div class="lbl">Peso médio / animal</div><div class="val" id="calc_res_medio">—</div></div>
          <div class="calc-res full"><div class="lbl">Valor financeiro total da operação</div><div class="val" id="calc_res_total">—</div></div>
        </div>
        <div class="meta" style="margin-top:14px">Estrutura preparada. As fórmulas serão configuradas na próxima etapa.</div>
      </div>`;
  };
})();