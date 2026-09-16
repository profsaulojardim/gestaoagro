/* V82 loader — carrega o fluxo V81 preservado e a correção mobile. */
(()=>{
  const core=document.createElement('script');
  core.src='troca-v81-core.js?v=82';
  core.onload=()=>{
    const fix=document.createElement('script');
    fix.src='troca-v82-fix.js?v=82';
    document.head.appendChild(fix);
  };
  document.head.appendChild(core);
})();