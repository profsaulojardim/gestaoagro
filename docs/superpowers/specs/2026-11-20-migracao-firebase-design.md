# Migração da nuvem: Supabase → Firebase Realtime Database

Data: 20/11/2026 · Dono: Saulo · Situação: aprovado o caminho (opção 1) e as fases; Fase 0 feita, Fase 1 em andamento.

## Por quê
O plano gratuito do Supabase pausa o projeto após ~7 dias "sem uso", e a consulta automática diária
(`manter-banco-ativo.yml`) não foi contada como uso: os dois bancos pausaram (teste ~15/11, uso ~18/11),
quebrando a sincronização ("Load failed"). O dono não quer pagar US$ 25/mês. O Firebase gratuito (Spark)
não pausa por inatividade e não pede cartão.

## Metas
- Sincronização, login, cópia de segurança na nuvem e perfil passam a usar o Firebase (Spark, grátis).
- Nenhum dado se perde; nada muda nas telas, cálculos e dados guardados no aparelho (IndexedDB).
- Migração em fases, primeiro no app de teste, com conferência de contagens e volta atrás possível.

## Não-metas
- Não reescrever o mecanismo de sincronização (pendências, conflitos por data/versão, offline): só o transporte.
- Não usar a biblioteca do Firebase (SDK). Não mudar o modelo de dados local.
- Não dar suporte a vários usuários na mesma fazenda (só o dono usa o app).

## Anti-metas (seria fracasso mesmo "funcionando")
- Perder ou duplicar registros; um aparelho sobrescrever edição mais nova de outro.
- O app deixar de abrir/lançar sem internet.
- Gravar endereço/chave do Firebase de teste no app em uso (ou o contrário).

## Restrições
- Só um usuário; app instalado no celular e no computador (cada um sobe seus dados na virada).
- Senhas do Supabase não podem ser levadas: o dono cria senha nova no Firebase (mesmo e-mail).
- Spark: Realtime Database 1 GB guardado, 10 GB/mês de download, 100 conexões simultâneas.
- Mesmo código nos dois repositórios; só `js/app/01-config-conta.js` (e o teste de sincronização) diferem.
- Sem store nova no IndexedDB; arquivos organizados conforme ARQUITETURA.md.

## Caminhos considerados
1. **Realtime Database via REST, sem biblioteca — ESCOLHIDO.** Árvore JSON espelha a tabela `sync_records`;
   troca só o transporte (`sbFetch` → chamadas REST do Firebase); sem arquivo grande extra; offline intacto.
2. Firestore via REST — limites parecidos, mas formato tipado de cada campo deixa o código maior e mais frágil;
   buscas avançadas não são necessárias.
3. Firestore com SDK oficial — exigiria descartar a sincronização atual e guardar uma biblioteca grande para
   o modo offline; ganho pequeno, risco maior.

## Desenho (decidido)
**Firebase (feito pelo dono, Fase 1):** dois projetos ("Rebanho Teste" e "Rebanho"), login por e-mail/senha
ativado, Realtime Database criado (us-central1, modo bloqueado) com as regras abaixo, app Web registrado.

Regras do Realtime Database:
```json
{
  "rules": {
    "contas": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "registros": { "$store": { ".indexOn": ["record_updated_at"] } }
      }
    }
  }
}
```

**Estrutura dos dados** (`/contas/{uid}/...`):
- `fazenda` — identificador da fazenda (o mesmo `organization_id` que os registros do aparelho já têm;
  na primeira entrada é o `active_org_id` do aparelho). Assim nenhum registro local precisa ser alterado.
- `manifesto/{store}/{id}` — `{u: record_updated_at, v: sync_version, d: deleted_at|null}` (pequeno, para a
  reconciliação do pull baixar só o que mudou).
- `registros/{store}/{id}` — `{payload, record_updated_at, deleted_at, sync_version, source_device_id}`.
- `backups/{device_id}` — cópia de segurança na nuvem (mesmo conteúdo de hoje em `cloud_backups`).
- `perfil` — nome, cargo, local, telefone, foto (hoje `profiles`).
Gravação de registro + manifesto numa única chamada (PATCH multi-caminho em `/contas/{uid}`).

**App (Fase 2, eu):**
- `01-config-conta.js`: config do Firebase (apiKey, databaseURL, projectId); sessão (idToken, refreshToken, uid,
  e-mail); login/cadastro/recuperar senha pela API REST do Firebase Auth; renovação do token; `fbFetch`.
- `09-perfil-nuvem-sincronizacao.js`: push/pull/conflitos usando manifesto + registros; cópia na nuvem;
  perfil; "fazenda" lida/gravada em `/contas/{uid}/fazenda`.
- Primeira entrada no Firebase: todos os registros do aparelho da fazenda ativa são marcados pendentes e
  enviados (conflito: vale o mais novo, regra atual); ao fim, tela de **conferência** (contagem por tipo no
  aparelho × na nuvem).
- Mensagem clara para falha de rede no lugar de "Load failed".
- Teste automático de sincronização entre dois aparelhos adaptado para o Firebase (com um Firebase falso local
  ou o projeto de teste).

**Fases e volta atrás:** 0 cópias em arquivo (feito) · 1 criar Firebase · 2 adaptar app e publicar só no teste ·
3 primeira entrada e conferência no teste, uso por alguns dias · 4 publicar no app em uso, entrar em cada
aparelho, conferência · 5 (semanas depois) remover a tarefa `manter-banco-ativo` e, se o dono quiser, os projetos do Supabase.
Até a fase 5, voltar = republicar a versão anterior (Supabase intacto).

## Decisões minhas (o dono pode corrigir)
- Região us-central1 (Realtime Database não tem São Paulo; latência é irrelevante para sincronizar).
- Reaproveitar o `organization_id` atual como "fazenda" para não reescrever dados do aparelho.
- O código do Supabase é substituído (não fica duplicado); a volta atrás é republicar a versão anterior pelo git.
  Na Fase 5 só se remove a tarefa `manter-banco-ativo` e, se o dono quiser, os projetos do Supabase.

## Deixado para quem implementa
- Detalhes da API REST (endpoints de Auth e `?auth=` / `shallow`), tamanho dos lotes de envio, textos das telas.
