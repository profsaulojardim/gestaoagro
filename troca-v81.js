/* V84 — fluxo de troca de lote + correção forte de rolagem mobile. */
(()=>{
  // A correção entra ANTES do fluxo para não depender do carregamento de outro arquivo.
  if(!document.getElementById('troca-v84-mobile')){
    const st=document.createElement('style');
    st.id='troca-v84-mobile';
    st.textContent=`
      #tl_lista_v81,
      .troca-lista{
        display:block !important;
        max-height:none !important;
        height:auto !important;
        overflow:visible !important;
        overflow-y:visible !important;
        -webkit-overflow-scrolling:auto !important;
        touch-action:pan-y !important;
        overscroll-behavior:auto !important;
      }
      .troca-sticky{
        position:static !important;
        inset:auto !important;
        bottom:auto !important;
        z-index:1 !important;
        background:transparent !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        padding:18px 0 2px !important;
        margin:0 !important;
      }
      .troca-animal-v81{
        min-height:62px !important;
        touch-action:pan-y !important;
      }
      body:has(#tl_lista_v81),
      main:has(#tl_lista_v81),
      #tela:has(#tl_lista_v81){
        overflow-y:visible !important;
        touch-action:pan-y !important;
      }
      #tl_lista_v81 + .troca-sticky,
      #tl_lista_v81 .troca-sticky{position:static !important;}
    `;
    document.head.appendChild(st);
  }

  function corrigirTela(){
    const root=document.getElementById('tl_lista_v81');
    if(!root)return;
    root.style.maxHeight='none';
    root.style.height='auto';
    root.style.overflow='visible';
    const lista=root.querySelector('.troca-lista');
    if(lista){lista.style.maxHeight='none';lista.style.height='auto';lista.style.overflow='visible';}
    const botao=root.querySelector('.troca-sticky');
    if(botao){botao.style.position='static';botao.style.bottom='auto';}
  }

  function corrigirPlural(root=document){
    root.querySelectorAll?.('option,.meta').forEach(el=>{
      let t=el.textContent||'';
      t=t.replace(/(\d+)\s+animal\(is\)/g,(_,n)=>`${n} ${Number(n)===1?'animal':'animais'}`);
      t=t.replace(/(\d+)\s+selecionado\(s\)/g,(_,n)=>`${n} ${Number(n)===1?'selecionado':'selecionados'}`);
      if(el.textContent!==t)el.textContent=t;
    });
  }

  const obs=new MutationObserver(()=>{corrigirTela();corrigirPlural();});
  obs.observe(document.body,{childList:true,subtree:true});
  corrigirTela();corrigirPlural();

  const core=document.createElement('script');
  core.src='troca-v81-core.js?v=84';
  core.onload=()=>{corrigirTela();corrigirPlural();};
  document.head.appendChild(core);
})();