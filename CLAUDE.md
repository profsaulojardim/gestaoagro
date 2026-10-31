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
4. Arquivo `.js` novo: incluir a tag `<script src="js/...">` no `index.html` (na ordem certa) e o caminho na
   lista `ARQUIVOS` do `sw.js`; depois rodar `python3 testes/conferir_arquivos.py`.

## Organização (V154) — ver ARQUITETURA.md
**Pedido do dono: TODA atualização deve ser feita bem organizada.** Em cada versão:
- Código no arquivo certo do assunto (núcleo `js/app/` primeiro); nada de remendo solto, arquivo `-vNNN` ou
  função duplicada. Se substituir algo, apagar o que ficou sem uso.
- Nomes claros em português, cabeçalho explicando cada arquivo novo, sem arquivos de teste/rascunho no repositório.
- Atualizar `ARQUITETURA.md` quando mudar onde fica alguma coisa; testes automáticos novos vão em `testes/`.
- `index.html` só tem a estrutura da página e a ordem dos scripts; visual em `css/estilo.css`; imagens em `img/`.
- Núcleo em `js/app/` (por assunto); ajustes/substituições de funções em `js/modulos/`; `js/app/99-iniciar.js` por último.
- Mudanças novas: preferir editar o arquivo do núcleo do assunto em vez de criar mais um módulo que substitui função.
- Chave e endereço do Supabase: `js/app/01-config-conta.js` (é onde se troca para a cópia de teste).

## Publicação
- O dono autorizou publicar direto na `main`. Mensagem do commit em português, começando por `VN: ...`,
  com a lista do que mudou.
- Testar antes (sintaxe com `node --check` em cada arquivo, `testes/conferir_arquivos.py`, fluxo no navegador
  headless e, se mexer na sincronização, `testes/sincronizacao_dois_aparelhos.js`) e conferir depois que o
  site publicado responde com a versão nova.
- A cada versão, atualizar também a cópia de teste: repositório `saulojardimspotify/gestaoagro3` (branch `main`,
  GitHub Pages; profsaulojardim é colaborador e o app Claude está instalado lá — push direto, desde 31/10/2026).
  Mesmos arquivos, sem CLAUDE.md, trocando endereço e chave do Supabase de teste (`homosmdrqtdxtmmmnbpd`,
  `sb_publishable_FcTVOwopuWb8WbzJaqEE5A_GGO1g9Ve`) em `js/app/01-config-conta.js` e em
  `testes/sincronizacao_dois_aparelhos.js`. Commit com a mesma mensagem `VN: ...`. O .zip só se o dono pedir.

## Cuidados conhecidos
- Registros contábeis (`tipo: "partida_contabil"`) ficam na store `lancamentos`: toda lista/soma de
  lançamentos deve filtrá-los.
- Não criar store nova no IndexedDB para sincronizar (o Supabase tem CHECK de `store_name`).
- Datas de fatos (compra, nascimento, pagamento, desmama) não podem ser no futuro.
- Medicamentos/vacinas (V142) são itens da store `insumos` (grupo "gado", categorias em `CAT_MED_ESTOQUE`).
  A store `medicamentos` é legada: só é lida pela migração `migrarMedicamentosParaEstoque()`; não gravar nela.
- Aplicação de medicamento (V144) passa sempre por `formAplicacao()`/`registrarAplicacaoEstoque()`: eventos com
  `aplicacaoId`, baixa no estoque (`insumo_mov` com `aplicacaoId`), custo `consumo_insumo` (Sanidade, `rateioLotes`)
  e partida D Custo de produção / C Estoque de insumos. Sem saldo, não aplica. Excluir evento ajusta tudo (hook no `del`).
- Saldo de insumo (V177): recalcular só com `reconstruirInsumo(id, alteracao)` (mantém saldo de itens sem entrada).
- Troca de lote (V177): sempre `moverAnimal(id, lote, data, hora)` — grava `loteDeId`/`loteParaId`, usados no
  histórico de lote/pasto por data (`historicoLotesAnimal`, `caminhoDoAnimal`) e na Análise por propriedade.
- Animais de serviço (V178, cavalo/burro/cão): store `animais` com `servico:true`; `getAll("animais")` já os exclui
  (use `getAll("animais",{servico:true})` para lê-los). Ficam FORA da contagem, lotação, UA e análise (pedido do dono).
  Gastos: categoria "Animais de serviço", `apropriacaoTipo:"servico"`, `animalServicoId`.

## Recursos desativados
- O módulo **Engorda e pesagens** foi desativado a pedido do dono na V129 (quer o app mais simples).
  O código está em `desativados/` (com LEIA-ME de como reativar) e no ramo `guardado-engorda-v128`.
  Não reativar nem sugerir de novo sem o dono pedir.
