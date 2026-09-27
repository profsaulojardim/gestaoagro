/* V117 — move "Gerenciar dados e reiniciar" do Histórico contábil para Perfil > Nuvem e segurança. */
(()=>{
  const BTN_ID='btn-gerenciar-v117';

  function ehPerfil(){
    if(!window.$t)return false;
    return [...$t.querySelectorAll('h1,h2,h3')].some(el=>/Nuvem e (segurança|backup)/i.test((el.textContent||'').trim()));
  }

  function removerDoHistorico(){
    document.getElementById('btn-gerenciar-v116')?.remove();
    if(!window.$t)return;
    const historico=[...$t.querySelectorAll('h1,h2,h3')].some(el=>/Histórico contábil/i.test((el.textContent||'').trim()));
    if(!historico)return;
    [...$t.querySelectorAll('button')].forEach(btn=>{
      if(/Gerenciar dados e reiniciar/i.test(btn.textContent||''))btn.remove();
    });
  }

  function inserirNoPerfil(){
    if(!ehPerfil()||document.getElementById(BTN_ID))return;
    const titulo=[...$t.querySelectorAll('h1,h2,h3')].find(el=>/Nuvem e (segurança|backup)/i.test((el.textContent||'').trim()));
    if(!titulo)return;
    const cab=titulo.closest('.sechead')||titulo.parentElement;
    const cloud=document.getElementById('cloudAccountBox');
    const btn=document.createElement('button');
    btn.id=BTN_ID;
    btn.className='btn btn-sec';
    btn.style.cssText='margin-top:10px;margin-bottom:4px';
    btn.innerHTML='⚙️ Gerenciar dados e reiniciar';
    btn.setAttribute('aria-label','Gerenciar e reiniciar dados da conta');
    btn.onclick=()=>{
      if(typeof window.gerenciarDadosV116==='function')window.gerenciarDadosV116();
      else alert('A área de gerenciamento de dados não foi carregada. Atualize o aplicativo e tente novamente.');
    };
    if(cloud)cloud.insertAdjacentElement('afterend',btn);
    else cab.insertAdjacentElement('afterend',btn);
  }

  function atualizarVersao(){
    const v=document.getElementById('app-versao');
    if(v)v.textContent='Versão 117';
  }

  function aplicar(){
    removerDoHistorico();
    inserirNoPerfil();
    atualizarVersao();
  }

  let agendado=false;
  function agendar(){
    if(agendado)return;
    agendado=true;
    requestAnimationFrame(()=>{agendado=false;aplicar();});
  }

  new MutationObserver(agendar).observe(document.body,{childList:true,subtree:true});
  aplicar();
  setTimeout(aplicar,250);
  setTimeout(aplicar,900);
})();
