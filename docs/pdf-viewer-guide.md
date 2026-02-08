# Guia do Visualizador de PDF

## Visão Geral

O sistema agora inclui um visualizador de PDF flutuante que permite:
- Fazer upload de um PDF por processo
- Visualizar o PDF enquanto navega entre as abas
- **Dois modos de visualização**: Paginado (página por página) ou Contínuo (rolagem vertical)
- Selecionar texto do PDF e inserir diretamente nos campos **Fundamentação** e **Comentários Calculistas**
- Navegação inteligente com rastreamento automático de página em modo contínuo

## Como Usar

### 1. Fazer Upload de um PDF

**Nas abas Decisões ou Verbas:**

1. Navegue até a aba **Decisões** ou **Verbas** com um processo selecionado
2. Localize o card **"Documento do Processo"** no topo da página
3. Arraste um arquivo PDF para a área de upload OU clique para selecionar
4. O arquivo será enviado e vinculado ao processo

**Importante:**
- Apenas 1 PDF por processo (substituir um PDF existente irá apagar o anterior)
- Tamanho máximo: 50MB
- Apenas arquivos PDF são aceitos

### 2. Abrir o Visualizador

Após fazer upload, clique no botão **"Abrir Visualizador de PDF"**

O visualizador abrirá como um painel flutuante à direita da tela.

### 3. Modos de Visualização

O visualizador oferece **dois modos de visualização**:

**Modo Paginado** (padrão):
- Mostra uma página por vez
- Navegação manual entre páginas
- Ideal para análise detalhada de páginas específicas

**Modo Contínuo**:
- Mostra todas as páginas em rolagem vertical
- Navegação natural com scroll do mouse
- Ideal para leitura fluida de documentos longos
- Atualiza automaticamente a página atual conforme você rola

Para alternar entre os modos, clique no botão **"Paginado"** ou **"Contínuo"** na barra de ferramentas. Sua preferência será salva automaticamente.

### 4. Navegação no PDF

**Controles disponíveis:**
- **←/→**: Navegar entre páginas (em ambos os modos)
- **+/-**: Aumentar/diminuir zoom
- **% (número)**: Resetar zoom para 100%
- **Campo numérico**: Digite o número da página para ir direto
- **Paginado/Contínuo**: Alterna entre modos de visualização
- **−** (minimizar): Minimiza o visualizador para um botão flutuante
- **×** (fechar): Fecha o visualizador

**Redimensionar:**
Arraste a borda esquerda do painel para ajustar a largura

**Navegação em Modo Contínuo:**
- Use o scroll do mouse para navegar naturalmente
- Os botões ←/→ fazem scroll suave até a página
- O campo numérico de página também faz scroll até a página desejada
- A página atual é atualizada automaticamente conforme você rola o documento

### 5. Selecionar e Inserir Texto

**Passo a passo:**

1. Com o visualizador aberto, selecione qualquer texto no PDF
2. Um menu aparecerá automaticamente com as opções:
   - **📋 Copiar**: Copia o texto para área de transferência
   - **→ Fundamentação**: Insere o texto no campo Fundamentação
   - **→ Comentários**: Insere o texto no campo Comentários Calculistas

3. Clique no botão do campo desejado
4. O texto será inserido na posição do cursor no editor

**Importante:**
- Você precisa estar na aba **Verbas** para inserir texto nos campos
- Os campos de Fundamentação e Comentários Calculistas precisam estar visíveis
- O texto é inserido onde o cursor estiver posicionado no editor

### 6. Trabalhar com Múltiplas Abas

O visualizador permanece aberto enquanto você navega entre as abas:

- Abra o PDF na aba **Decisões**
- Navegue para a aba **Verbas**
- Selecione texto e insira nos formulários
- O visualizador continua aberto e sincronizado

### 7. Substituir ou Remover PDF

**Substituir:**
1. Clique no botão **"Substituir PDF"** no card do documento
2. Selecione o novo arquivo
3. Confirme a substituição

**Remover:**
1. Clique no ícone da lixeira (🗑️) no card do documento
2. Confirme a remoção

## Armazenamento

- **Temporário**: Os arquivos são armazenados temporariamente na sessão do navegador
- **Supabase (futuro)**: A infraestrutura já está preparada para salvar no Supabase Storage

## Atalhos de Teclado

Quando o visualizador está aberto (funcionam em ambos os modos):
- **Setas ← →**: Página anterior / Próxima página
- **Setas ↑ ↓**: Página anterior / Próxima página
- **Page Up**: Página anterior
- **Page Down**: Próxima página
- **Home**: Vai para a primeira página
- **End**: Vai para a última página

**Nota**: Os atalhos de teclado não funcionam quando você está digitando em campos de texto (inputs/textareas).

## Dicas

1. **Organização**: Mantenha seus PDFs organizados - 1 PDF por processo
2. **Atualização**: Quando adicionar mais páginas ao PDF, faça o upload do arquivo completo atualizado
3. **Performance**: PDFs muito grandes (>50MB) não são permitidos para manter a performance
4. **Seleção**: Para melhor precisão, use zoom para selecionar textos pequenos
5. **Navegação**: Minimize o visualizador quando não estiver usando para ter mais espaço na tela
6. **Modo Contínuo**: Use o modo contínuo para ler documentos longos de forma mais natural
7. **Modo Paginado**: Use o modo paginado para análise detalhada e comparação de páginas específicas
8. **Preferências Salvas**: Sua escolha de modo de visualização e largura do painel são salvas automaticamente

## Solução de Problemas

**Visualizador não abre:**
- Verifique se o PDF foi enviado com sucesso
- Recarregue a página e tente novamente

**Texto não é inserido:**
- Certifique-se de estar na aba Verbas
- Verifique se o campo está visível (não está em um modal fechado)
- O campo precisa estar no modo de edição

**PDF não carrega:**
- Verifique o tamanho do arquivo (máximo 50MB)
- Certifique-se de que é um PDF válido
- Tente fazer upload novamente

## Tecnologias Utilizadas

- **react-pdf**: Renderização de PDFs no navegador
- **Supabase Storage**: Armazenamento em nuvem (preparado para uso futuro)
- **React Context API**: Gerenciamento de estado global do visualizador
- **TailwindCSS**: Estilização responsiva e moderna
