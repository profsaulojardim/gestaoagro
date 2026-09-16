/* V87 — textos e hierarquia visual da área de segurança/backup do Perfil. */
(()=>{
  const STYLE_ID='perfil-backup-v87-style';
  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .backup-recuperar-v87{border-color:#B7791F !important;color:#8A5A00 !important;background:#FFFBF2 !important;}
      .backup-aviso-v87{margin:10px 2px 2px;padding:11px 12px;border-radius:12px;background:#FFF8E8;color:#76520A;font-size:12.5px;line-height:1.4;border:1px solid #F0D89B;}
      .backup-aviso-v87 strong{display:block;margin-bottom:2px;color:#654500;}
    `;
    document.head.appendChild(st);
  }

  function textoExato(el,antes,depois){
    if(el && el.textContent.trim()===antes) el.textContent=depois;
  }

  function aplicar(){
    // Títulos e rótulos: mantém a função, mas troca "backup" por linguagem mais clara.
    document.querySelectorAll('h1,h2,h3,.ti,.meta,.cloud-note,div,span').forEach(el=>{
      if(el.children.length) return;
      const t=(el.textContent||'').trim();
      if(t==='Nuvem e backup') el.textContent='Nuvem e segurança';
      else if(t==='Backup manual') el.textContent='Cópia externa';
      else if(t.startsWith('Último backup na nuvem:')) el.textContent=t.replace('Último backup na nuvem:','Última cópia de segurança:');
      else if(t==='Nenhum backup salvo ainda.') el.textContent='Nenhuma cópia externa salva ainda.';
      else if(t.includes('Use o arquivo .json como cópia extra de segurança ou para transferência manual.')) el.textContent='Use o arquivo .json como uma cópia extra de segurança ou para transferência manual.';
    });

    document.querySelectorAll('button').forEach(btn=>{
      const t=(btn.textContent||'').replace(/\s+/g,' ').trim();
      if(t.includes('Backup na nuvem')){
        btn.innerHTML='☁️ Criar cópia de segurança';
        btn.setAttribute('aria-label','Criar cópia de segurança na nuvem');
      }
      if(t.includes('Restaurar backup')){
        btn.innerHTML='↥ Recuperar cópia anterior';
        btn.setAttribute('aria-label','Recuperar cópia de segurança anterior');
        btn.classList.add('backup-recuperar-v87');
        const pai=btn.parentElement;
        if(pai && !pai.querySelector('.backup-aviso-v87')){
          const aviso=document.createElement('div');
          aviso.className='backup-aviso-v87';
          aviso.innerHTML='<strong>Use somente quando precisar recuperar dados.</strong>A recuperação substitui os dados locais deste aparelho pela cópia salva. Antes de confirmar, o app mostrará a data e a hora da cópia que será recuperada.';
          pai.appendChild(aviso);
        }
      }
      if(t.includes('Baixar backup (.json)')){
        btn.innerHTML='⬇️ Baixar cópia (.json)';
        btn.setAttribute('aria-label','Baixar cópia de segurança em arquivo JSON');
      }
    });

    // Remove a antiga nota técnica de versão da tela de Perfil e põe uma explicação útil.
    document.querySelectorAll('.cloud-note,p,div').forEach(el=>{
      if(el.children.length) return;
      const t=(el.textContent||'').trim();
      if(t.startsWith('A V80 mantém a sincronização automática')){
        el.textContent='A sincronização mantém seus dados atualizados entre aparelhos. A cópia de segurança serve como uma proteção adicional para recuperação.';
      }
    });
  }

  let agendado=false;
  function agendar(){
    if(agendado)return;
    agendado=true;
    requestAnimationFrame(()=>{agendado=false;aplicar();});
  }
  new MutationObserver(agendar).observe(document.body,{childList:true,subtree:true});
  aplicar();
})();