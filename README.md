# Sistema de Revisão de Verbas Trabalhistas

Um sistema completo para gerenciamento de processos trabalhistas, decisões judiciais e verbas, com armazenamento em nuvem via Supabase.

## 🚀 Funcionalidades

### 📋 Gestão de Processos
- Cadastro completo de processos trabalhistas
- Campos: número, reclamante, reclamada, observações
- Validação automática de dados
- Busca e filtros avançados

### ⚖️ Decisões Judiciais
- Registro de decisões vinculadas aos processos
- Tipos: Sentença, Acórdão, Despacho, etc.
- Situações: Procedente, Improcedente, etc.
- Observações detalhadas

### 💰 Verbas Trabalhistas (Estrutura Hierárquica)
- **Verbas**: Tipos dinâmicos e personalizáveis (ex: Horas Extras, Danos Morais, FGTS, etc.)
- **Lançamentos**: Decisões específicas sobre cada verba
- Fundamentação jurídica com editor rich text
- Comentários técnicos dos calculistas
- Situações: Deferida, Reformada, Indeferida, etc.
- **Novo**: Sistema de tipos dinâmicos permite criar e renomear tipos por processo
- **Novo**: Interface de gerenciamento avançado de tipos de verba

### 📊 Relatórios
- Exportação em HTML com design profissional
- Estrutura hierárquica das verbas
- Cabeçalho e rodapé personalizados
- Pronto para impressão

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Editor**: ReactQuill para textos ricos
- **Build**: Vite
- **Deployment**: Bolt Hosting

## 📦 Configuração

### 1. Pré-requisitos
- Node.js 18+ 
- Conta no Supabase

### 2. Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. No painel do Supabase, vá em **SQL Editor**
3. Execute o script de migração disponível em `supabase/migrations/create_initial_schema.sql`
4. Anote a **URL do projeto** e a **chave pública** em **Settings > API**

### 3. Configuração do Projeto

1. Clone o repositório e instale dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

3. Edite o arquivo `.env` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_do_projeto_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_publica_supabase
```

4. Execute o projeto:
```bash
npm run dev
```

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

1. **processes** - Processos trabalhistas
   - id, numero_processo, reclamante, reclamada, observacoes_gerais

2. **decisions** - Decisões judiciais
   - id, process_id, tipo_decisao, id_decisao, situacao, observacoes

3. **verbas** - Tipos de verbas trabalhistas (DINÂMICOS)
   - id, process_id, tipo_verba

4. **verba_lancamentos** - Lançamentos específicos por decisão
   - id, verba_id, decisao_vinculada, situacao, fundamentacao, comentarios_calculistas

5. **custom_enum_values** - Sistema de valores dinâmicos (NOVO)
   - id, enum_name, enum_value, created_by_process_id, created_at

### Relacionamentos
- Processes → Decisions (1:N)
- Processes → Verbas (1:N) 
- Verbas → Verba_Lancamentos (1:N)
- **Novo**: Processes → Custom_Enum_Values (1:N, opcional)

## 🏗️ Arquitetura

### Frontend (React)
```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes UI reutilizáveis
│   └── TipoVerbaManagementModal.tsx # Novo: Gerenciamento de tipos
├── hooks/              # Hooks personalizados
│   └── useTipoVerbaManager.ts # Novo: Hook para tipos dinâmicos
├── services/           # Serviços de API
│   └── tipoVerbaManager.service.ts # Novo: Serviço para tipos dinâmicos
├── types/             # Definições TypeScript
├── utils/             # Utilitários
├── lib/               # Configurações (Supabase)
└── constants/         # Constantes da aplicação
```

### Serviços
- **ProcessesService** - CRUD de processos
- **DecisionsService** - CRUD de decisões  
- **VerbasService** - CRUD hierárquico de verbas
- **TipoVerbaManagerService** - NOVO: Gerenciamento dinâmico de tipos de verba
- **ProcessEnumValuesService** - NOVO: Valores específicos por processo

### Hooks
- **useProcesses** - Gerencia processos
- **useDecisions** - Gerencia decisões
- **useVerbas** - Gerencia verbas (estrutura hierárquica)
- **useTipoVerbaManager** - NOVO: Gerencia tipos dinâmicos de verba
- **useProcessSpecificEnums** - NOVO: Enums específicos por processo

## 📱 Funcionalidades Destacadas

### 🔗 Navegação Inteligente
- Menu de navegação responsivo
- Estados de loading e erro
- Feedback visual em todas as operações
- **Novo**: Modal dedicado para gerenciamento de tipos dinâmicos

### 💾 Persistência Robusta
- Armazenamento em nuvem via Supabase
- Validação automática de dados
- Tratamento de erros completo
- Sistema de logging detalhado
- **Novo**: Tipos de verba como TEXT no banco para total flexibilidade
- **Novo**: Sistema de cache inteligente para tipos dinâmicos

### 📄 Sistema de Relatórios
- Exportação HTML profissional
- Design baseado no layout original
- Cabeçalho com logo e informações de contato
- Estrutura hierárquica das verbas
- Pronto para impressão/PDF

### 🔒 Segurança
- Row Level Security (RLS) no Supabase
- Validação client e server-side
- Tratamento de erros seguro

## 🚢 Deploy

O sistema está configurado para deploy automático no Bolt Hosting:

```bash
# O deploy é feito automaticamente via Bolt
# Ou manualmente:
npm run build
```

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm run dev      # Desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build
npm run lint     # Linting
```

### Estrutura de Commits
- feat: Nova funcionalidade
- fix: Correção de bug
- docs: Documentação
- refactor: Refatoração
- style: Formatação

### 🎯 Tipos de Verba Dinâmicos
- Criação de novos tipos personalizados por processo
- Renomeação de tipos existentes (afeta todas as verbas do tipo)
- Dropdown inteligente com sugestões baseadas no histórico
- Validação automática de nomes de tipos
- Cache otimizado para performance

### 📊 Gerenciamento Avançado
- Interface dedicada para administração de tipos
- Estatísticas de uso por tipo (verbas, processos, lançamentos)
- Histórico de criação e última utilização
- Operações em lote para renomeação e limpeza

### 🔧 Arquitetura Escalável
- Banco preparado para expansão de outros campos dinâmicos
- Serviços modulares para fácil manutenção
- Sistema de cache inteligente multi-camadas
- Logging detalhado para auditoria e debug

## 📞 Contato

**CalculoPro**
- Email: contato@calculopro.com.br
- Telefone: (14) 99606-7654
- Website: www.calculopro.com.br

## 📄 Licença

Este projeto é propriedade da CalculoPro Ltda.

---

Sistema desenvolvido com ❤️ para modernizar o gerenciamento de verbas trabalhistas.