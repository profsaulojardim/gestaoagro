# Gestão do Rebanho (gestaoagro) — regras de trabalho

PWA publicado pelo GitHub Pages a partir da branch `main` (https://profsaulojardim.github.io/gestaoagro/).
Dados: IndexedDB local + sincronização Supabase (tabela `sync_records`; novos campos vão no `payload`, sem mudar o banco).

## Versão (fazer SEMPRE, sem o dono pedir)
1. Antes de publicar, consultar a versão que está no ar: `APP_VERSION` em `sw.js` na `main`
   (ou em https://profsaulojardim.github.io/gestaoagro/sw.js).
2. Somar 1 e atualizar em `sw.js`:
   - `const APP_VERSION = "N";`
   - `const CACHE = "rebanho-vN-<resumo>";` (nome novo força a atualização dos aparelhos)
3. O número exibido na tela inicial ("Versão N") vem automaticamente do `?v=` que o service worker
   coloca nos scripts — não escrever o número fixo em nenhum outro arquivo.
4. Arquivo `.js` novo: incluir nas DUAS listas do `sw.js` (`CORE` e `scripts`) e na linha de `<script>` injetada.

## Publicação
- O dono autorizou publicar direto na `main`. Mensagem do commit em português, começando por `VN: ...`,
  com a lista do que mudou.
- Testar antes (sintaxe com `node --check` e fluxo no navegador headless) e conferir depois que o site
  publicado responde com a versão nova.

## Cuidados conhecidos
- Registros contábeis (`tipo: "partida_contabil"`) ficam na store `lancamentos`: toda lista/soma de
  lançamentos deve filtrá-los.
- Não criar store nova no IndexedDB para sincronizar (o Supabase tem CHECK de `store_name`).
- Datas de fatos (compra, nascimento, pagamento, desmama) não podem ser no futuro.
