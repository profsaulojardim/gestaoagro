/* V82 — correção mobile da seleção de animais na troca de lote.
   Remove a rolagem interna e deixa a página inteira rolar naturalmente,
   evitando que o botão Continuar cubra os últimos animais no iPhone. */
(()=>{
  if(document.getElementById('troca-v82-fix-style')) return;
  const st=document.createElement('style');
  st.id='troca-v82-fix-style';
  st.textContent=`
    .troca-lista{
      max-height:none !important;
      height:auto !important;
      overflow:visible !important;
      -webkit-overflow-scrolling:auto !important;
      touch-action:pan-y !important;
    }
    .troca-sticky{
      position:static !important;
      bottom:auto !important;
      z-index:auto !important;
      background:transparent !important;
      backdrop-filter:none !important;
      -webkit-backdrop-filter:none !important;
      padding:14px 0 4px !important;
      margin-top:4px !important;
    }
    #tl_lista_v81{overflow:visible !important;}
    .troca-animal-v81{min-height:58px;}
  `;
  document.head.appendChild(st);
})();