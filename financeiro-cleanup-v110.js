/* V110 — vendas de animais somente pelo fluxo operacional. */
(()=>{
  const vendasOperacionais = /^(venda de bezerro|venda de matriz\s*\/\s*descarte|venda de animais?)$/i;

  function limparCategoriasVenda(){
    const tipo=document.getElementById('lc_tipo');
    const cat=document.getElementById('lc_cat');
    if(!cat || (tipo && tipo.value!=='receita')) return;

    [...cat.options].forEach(op=>{
      const texto=(op.textContent||op.value||'').trim();
      const valor=(op.value||'').trim();
      if(vendasOperacionais.test(texto) || vendasOperacionais.test(valor)) op.remove();
    });

    if(cat.selectedIndex<0 && cat.options.length) cat.selectedIndex=0;
  }

  // O formulário financeiro é montado dinamicamente em modal.
  // Mantém as categorias de venda fora do lançamento manual, inclusive após trocar o tipo.
  const observar=()=>{
    limparCategoriasVenda();
    const alvo=document.body;
    if(!alvo) return;
    new MutationObserver(limparCategoriasVenda).observe(alvo,{childList:true,subtree:true});
    document.addEventListener('change',e=>{
      if(e.target && e.target.id==='lc_tipo') setTimeout(limparCategoriasVenda,0);
    });
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observar);
  else observar();
})();
