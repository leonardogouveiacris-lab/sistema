# Checklist de Logging

Use este checklist em novos commits para manter logs úteis, consistentes e com baixo ruído.

## 1) Quando logar

- [ ] **Ações de usuário relevantes** (criação, atualização, exclusão, import/export).
- [ ] **Eventos de integração/rede** (chamadas Supabase, falhas de assinatura realtime, erros externos).
- [ ] **Eventos de renderização PDF** importantes (início/fim de operações críticas, falhas).
- [ ] **Erros recuperáveis e não recuperáveis** com contexto suficiente para diagnóstico.
- [ ] **Evitar logs de alto volume** em loops/eventos muito frequentes, exceto em `debug`.

## 2) Nível correto

- [ ] `error`: falhas que interrompem fluxo ou exigem investigação.
- [ ] `warn`: comportamento inesperado com fallback.
- [ ] `info`: marcos funcionais de auditoria (ex.: operação concluída).
- [ ] `success`: apenas quando adicionar clareza de negócio além de `info`.
- [ ] `debug`: eventos frequentes/verbosos (ex.: callbacks realtime recorrentes, fetch de rotina).

## 3) Categoria obrigatória

Ao criar logs estruturados, classifique o evento em uma categoria:

- [ ] `ui`
- [ ] `realtime`
- [ ] `network`
- [ ] `pdf-render`
- [ ] `storage`
- [ ] `user-action`

## 4) Contexto mínimo

- [ ] Nome do domínio/componente no `context` (ex.: `useRealtimeSubscription`, `highlights.service`).
- [ ] `event` curto e estável (snake_case ou kebab-case).
- [ ] IDs e chaves de correlação necessários (`processId`, `documentId`, `table`, etc.).
- [ ] Não registrar payloads sensíveis (dados pessoais, conteúdo completo de documentos).

## 5) Padronização por helper

- [ ] Realtime: usar `logRealtimeEvent(...)`.
- [ ] PDF: usar `logPdfEvent(...)`.
- [ ] Em novos domínios, criar helper dedicado quando houver repetição.

## 6) Consolidação de ruído

- [ ] Evitar duplicar logs para o mesmo evento em cadeia (hook + serviço + componente).
- [ ] Em refresh realtime, preferir **um único log agregado** por ciclo.
- [ ] Promover para `info` apenas o que for auditável; manter telemetria ruidosa em `debug`.
