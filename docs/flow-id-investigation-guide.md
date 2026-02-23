# Guia rápido: uso de `flowId` no PDF Viewer

Este guia descreve como correlacionar logs de uma mesma operação de usuário no fluxo do PDF Viewer.

## Contrato de metadados do logger

Os logs estruturados usam `metadata` com o contrato abaixo:

- `flowId`: identificador único da operação.
- `entityType`: tipo da entidade principal (`pdf-viewer`, `pdf-page`, `highlight`, `comment`, `connector`).
- `entityId`: id da entidade (quando disponível).
- `action`: ação executada (`open`, `navigate-with-highlight`, `create`, etc).
- `source`: origem fixa do log (`Arquivo.metodo`).

## Gerando e propagando `flowId`

Use utilitários de `src/utils/flowId.ts`:

- `generateFlowId()`: gera um id novo para a operação.
- `createFlowContext(...)`: monta o objeto de metadados para log.

### Padrão recomendado

1. Gere um `flowId` no início da operação do usuário.
2. Inclua `metadata: createFlowContext(...)` em todos os logs dessa operação.
3. Passe `{ flowId }` para chamadas de serviço relacionadas.

## Exemplos de operações críticas

- Abrir visualizador: `PDFViewerContext.openViewer`.
- Navegar com destaque: `PDFViewerContext.navigateToPageWithHighlight`.
- Criar highlight: `FloatingPDFViewer.handleCreateHighlight` + `highlights.service.createHighlight`.
- Criar comentário: `CommentLayer.handleLayerClick` + `PDFCommentsService.createComment`.
- Salvar conector: `ConnectorDrawer.handleMouseUp` + `PDFCommentsService.createConnector`.

## Investigação

Para investigar um incidente:

1. Localize um log com falha no browser console.
2. Copie o `metadata.flowId`.
3. Filtre os logs pelo mesmo `flowId` para reconstruir toda a operação ponta a ponta.
