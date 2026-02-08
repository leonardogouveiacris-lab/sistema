# Atualizações Necessárias no TypeScript após Migração tipo_verba

## Resumo da Migração
A coluna `tipo_verba` da tabela `verbas` foi convertida de tipo `ENUM` para `TEXT`, permitindo valores totalmente dinâmicos e flexibilidade para renomeação.

## Arquivos que Precisam ser Atualizados

### 1. `src/types/database.ts`
**O que mudar:**
- Remover `TipoVerbaEnum` da interface
- Alterar tipo de `tipo_verba` para `string` em todas as referências
- Atualizar comentários para refletir que é campo TEXT dinâmico

```typescript
// ANTES (ENUM):
export type TipoVerbaEnum = 'Salários' | 'Horas Extras' | ... ;

// DEPOIS (TEXT):
// Remover completamente TipoVerbaEnum

// ANTES nas interfaces:
tipo_verba: TipoVerbaEnum;

// DEPOIS nas interfaces:
tipo_verba: string; // Campo TEXT para valores dinâmicos
```

### 2. `src/types/Verba.ts`
**O que mudar:**
- Remover `TIPOS_VERBA_PREDEFINIDOS` completamente
- Remover tipo `TipoVerba`
- Alterar interface `Verba` para usar `string` em `tipoVerba`

```typescript
// REMOVER COMPLETAMENTE:
export const TIPOS_VERBA_PREDEFINIDOS = [...];
export type TipoVerba = typeof TIPOS_VERBA_PREDEFINIDOS[number];

// MANTER COMO ESTÁ (já usa string):
export interface Verba extends BaseEntity {
  tipoVerba: string; // ✓ Já é string, sem mudança necessária
  // ...
}
```

### 3. `src/services/verbas.service.ts`
**O que mudar:**
- Atualizar imports removendo `TipoVerbaEnum`
- Alterar `verbaToInsert` para não fazer cast para enum
- Adicionar novos métodos para gerenciar valores dinâmicos

```typescript
// ANTES:
import { TipoVerbaEnum } from '../types/database';
tipo_verba: tipoVerba as TipoVerbaEnum

// DEPOIS:
// Remover import de TipoVerbaEnum
tipo_verba: tipoVerba // Diretamente como string
```

### 4. Componentes UI que Referenciam TIPOS_VERBA_PREDEFINIDOS
**Arquivos afetados:**
- `src/components/VerbaForm.tsx`
- `src/components/VerbaEditModal.tsx`

**O que mudar:**
- Remover imports de `TIPOS_VERBA_PREDEFINIDOS`
- Modificar `CustomDropdown` para usar lista dinâmica baseada em dados reais

```typescript
// ANTES:
import { TIPOS_VERBA_PREDEFINIDOS } from '../types/Verba';
options={TIPOS_VERBA_PREDEFINIDOS}

// DEPOIS:
// Usar lista dinâmica carregada de VerbasService.getDistinctTipoVerbaValues()
options={tipoVerbaOptions} // Será carregado dinamicamente
```

## Cronograma de Implementação Recomendado

### Etapa 1: Atualizações de Tipo (Preparação)
1. Atualizar `src/types/database.ts`
2. Atualizar `src/types/Verba.ts`
3. Atualizar `src/services/verbas.service.ts`

### Etapa 2: Novos Métodos de Serviço
1. Implementar `getDistinctTipoVerbaValues()` em `VerbasService`
2. Implementar `renameTipoVerba()` em `VerbasService`
3. Atualizar `useVerbas` hook

### Etapa 3: Atualizações de UI
1. Modificar `VerbaForm.tsx` para dropdown dinâmico
2. Modificar `VerbaEditModal.tsx` para dropdown dinâmico
3. Adicionar funcionalidade de renomear

### Etapa 4: Testes de Validação
1. Testar criação de verbas com valores personalizados
2. Testar renomeação de tipos de verba
3. Testar exclusão e comportamento do dropdown

## Considerações Importantes

### Backward Compatibility
- Todos os dados existentes são preservados
- Valores que antes eram válidos no ENUM continuam válidos como TEXT
- Nenhuma funcionalidade existente é quebrada

### Performance
- Novo índice em `tipo_verba` garante performance das consultas DISTINCT
- Cache no frontend minimiza consultas repetidas ao banco

### Validação
- Constraints SQL garantem integridade dos dados no nível de banco
- Validação TypeScript mantém type safety no frontend