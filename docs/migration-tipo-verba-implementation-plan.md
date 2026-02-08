# Plano de Implementação: Tipo de Verba Dinâmico

## Estado Atual (Após Migração do Banco)
✅ **Banco de Dados**: Coluna `tipo_verba` convertida de ENUM para TEXT  
⏳ **Frontend**: Precisa ser atualizado para trabalhar com valores dinâmicos  

## Implementação das Próximas Fases

### Fase 1: Adaptação dos Serviços e Tipos TypeScript

#### 1.1 Atualizar Types (`src/types/`)
**Arquivo: `src/types/database.ts`**
- Alterar `TipoVerbaEnum` para `string` 
- Remover definição do enum que não existe mais no banco

**Arquivo: `src/types/Verba.ts`**
- Remover `TIPOS_VERBA_PREDEFINIDOS` completamente
- Interface `Verba` já usa `string`, não precisa alteração

#### 1.2 Atualizar Serviços (`src/services/verbas.service.ts`)
- Remover cast `as TipoVerbaEnum` 
- Adicionar método `getDistinctTipoVerbaValues()` para dropdown dinâmico
- Adicionar método `renameTipoVerba()` para renomeação
- Adicionar método `getVerbasByTipo()` para consultas específicas

### Fase 2: Atualização dos Componentes UI

#### 2.1 Formulários (`src/components/VerbaForm.tsx`)
- Modificar `CustomDropdown` para usar lista dinâmica
- Remover referência a `TIPOS_VERBA_PREDEFINIDOS`
- Implementar carregamento das opções via `getDistinctTipoVerbaValues()`

#### 2.2 Modal de Edição (`src/components/VerbaEditModal.tsx`)  
- Adicionar funcionalidade "Renomear Tipo de Verba"
- Modificar dropdown para usar valores dinâmicos
- Implementar confirmação para renomeação

#### 2.3 Lista de Verbas (`src/components/VerbaList.tsx`)
- Adicionar botão "Excluir Tipo Completo" 
- Implementar lógica para exclusão de todas as verbas de um tipo

### Fase 3: Atualização dos Hooks

#### 3.1 Hook useVerbas (`src/hooks/useVerbas.ts`)
- Adicionar função `renameTipoVerba()`
- Adicionar função `removeTipoVerba()` 
- Atualizar refresh automático após operações

#### 3.2 Modificar Enum Dinâmico (`src/hooks/useProcessSpecificEnums.ts`)
- Criar lógica especial para `tipo_verba`
- Usar `VerbasService.getDistinctTipoVerbaValues()` ao invés de enum system
- Manter compatibilidade com outros enums (decisão, situação)

## Funcionalidades Resultantes

### 1. Dropdown Dinâmico de Tipo de Verba
```typescript
// O dropdown será povoado por:
const tipoVerbaOptions = await VerbasService.getDistinctTipoVerbaValues();
// Retorna: ['Danos Morais', 'Horas Extras', 'FGTS', ...]
```

### 2. Renomear Tipo de Verba  
```typescript
// Renomeia um tipo em todas as verbas de um processo
await VerbasService.renameTipoVerba(
  'Danos Morais', 
  'Danos Morais e Materiais', 
  processId
);
```

### 3. Exclusão Automática do Dropdown
- Quando a última verba de um tipo é excluída
- O tipo automaticamente sai do dropdown (consulta DISTINCT)
- Comportamento natural, sem lógica adicional necessária

### 4. Valores Totalmente Personalizados
- Usuário digita qualquer valor no dropdown
- Valor é salvo diretamente como TEXT
- Fica disponível para seleção futura automaticamente

## Cronograma Recomendado

**Agora**: Migração do banco executada ✅  
**Próximo**: Fase 1 - Atualizar tipos e serviços  
**Depois**: Fase 2 - Atualizar componentes UI  
**Final**: Fase 3 - Atualizar hooks e testes  

## Compatibilidade

### Mantida
- Todos os dados existentes preservados
- Funcionalidades atuais continuam funcionando  
- Outros enums (decisão, situação_verba) inalterados

### Nova
- Valores de tipo_verba totalmente dinâmicos
- Renomeação de tipos de verba por processo
- Exclusão automática de tipos não utilizados
- Interface mais intuitiva e flexível

---

**Status**: Pronto para implementar as próximas fases no código TypeScript.