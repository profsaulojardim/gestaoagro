/* V83 loader — carrega o fluxo V81 preservado e as correções mobile/texto. */
(()=>{
  const core=document.createElement('script');
  core.src='troca-v81-core.js?v=83';
  core.onload=()=>{
    const fix=document.createElement('script');
    fix.src='troca-v82-fix.js?v=83';
    document.head.appendChild(fix);
  };
  document.head.appendChild(core);
})();