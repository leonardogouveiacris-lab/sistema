/**
 * Template HTML para exportação de relatórios
 * 
 * Este arquivo contém o template completo HTML com todos os estilos CSS
 * necessários para manter a mesma aparência visual do sistema original.
 * Inclui Tailwind CSS e estilos personalizados para garantir fidelidade visual
 * (com ajustes para remover comentários calculistas e identificadores visuais
 * para um relatório mais limpo e profissional).
 * 
 * Agora inclui suporte completo para cabeçalho e rodapé personalizados,
 * separados em arquivo dedicado para melhor manutenibilidade.
 */

import HTMLHeaderFooter from './htmlHeader';

/**
 * Template HTML base com meta tags e configurações essenciais
 * Inclui viewport responsivo e encoding UTF-8 para compatibilidade
 * 
 * O template foi reorganizado para suportar cabeçalho e rodapé dinâmicos,
 * mantendo compatibilidade com o sistema existente.
 */
const HTML_BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <style>
        /* Reset CSS básico para garantir consistência visual */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #374151;
            background-color: #f9fafb;
        }

        /* Classes Tailwind CSS essenciais implementadas manualmente */
        .container { max-width: 1024px; margin: 0 auto; padding: 0 1.5rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-x-3 > * + * { margin-left: 0.75rem; }
        .space-x-4 > * + * { margin-left: 1rem; }

        /* Fix: Adiciona margens específicas para cards */
        .mb-2 { margin-bottom: 0.5rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-6 { margin-top: 1.5rem; }
        
        /* Layout e estrutura */
        .bg-white { background-color: #ffffff; }
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .rounded-lg { border-radius: 0.5rem; }
        .border { border-width: 1px; border-style: solid; }
        .border-gray-100 { border-color: #f3f4f6; }
        .border-gray-200 { border-color: #e5e7eb; }
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-t { border-top-width: 1px; border-top-style: solid; }
        .border-l-4 { border-left-width: 4px; border-left-style: solid; }
        .border-l-gray-300 { border-left-color: #d1d5db; }
        .rounded { border-radius: 0.25rem; }
        .rounded-full { border-radius: 9999px; }
        .rounded-r-lg { border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }
        .rounded-t-lg { border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; }
        
        /* Padding e margin */
        .p-4 { padding: 1rem; }
        .p-5 { padding: 1.25rem; }
        .p-6 { padding: 1.5rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
        .py-0\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .px-2\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .pl-4 { padding-left: 1rem; }
        .pl-5 { padding-left: 1.25rem; }
        .pt-2 { padding-top: 0.5rem; }
        .pt-3 { padding-top: 0.75rem; }
        .pt-4 { padding-top: 1rem; }
        .pb-2 { padding-bottom: 0.5rem; }
        .pb-3 { padding-bottom: 0.75rem; }
        .pb-6 { padding-bottom: 1.5rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-6 { margin-top: 1.5rem; }
        .ml-2 { margin-left: 0.5rem; }
        .mr-2 { margin-right: 0.5rem; }
        .pt-2 { padding-top: 0.5rem; }
        .pb-2 { padding-bottom: 0.5rem; }

        /* Tipografia */
        .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
        .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
        .text-base { font-size: 1rem; line-height: 1.5rem; }
        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
        
        /* Cores de texto */
        .text-gray-900 { color: #111827; }
        .text-gray-700 { color: #374151; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-500 { color: #6b7280; }
        .text-gray-400 { color: #9ca3af; }
        .text-blue-600 { color: #2563eb; }
        .text-blue-700 { color: #1d4ed8; }
        .text-green-700 { color: #15803d; }
        .text-green-600 { color: #16a34a; }
        .text-orange-700 { color: #c2410c; }
        .text-orange-600 { color: #ea580c; }
        .text-cyan-700 { color: #0e7490; }
        .text-yellow-700 { color: #a16207; }

        /* Cores de background */
        .bg-blue-100 { background-color: #dbeafe; }
        .bg-green-100 { background-color: #dcfce7; }
        .bg-orange-100 { background-color: #ffedd5; }
        .bg-cyan-100 { background-color: #cffafe; }
        .bg-yellow-100 { background-color: #fef3c7; }
        .bg-yellow-200 { background-color: #fde68a; }

        /* Cores de border */
        .border-yellow-200 { border-color: #fde68a; }

        /* Tamanhos fixos para badges circulares */
        .w-6 { width: 1.5rem; }
        .h-6 { height: 1.5rem; }
        .w-8 { width: 2rem; }
        .h-8 { height: 2rem; }

        /* Backgrounds para gradientes */
        .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
        .from-blue-50 { --tw-gradient-from: #eff6ff; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(239, 246, 255, 0)); }
        .from-green-50 { --tw-gradient-from: #f0fdf4; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(240, 253, 244, 0)); }
        .from-orange-50 { --tw-gradient-from: #fff7ed; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(255, 247, 237, 0)); }
        .to-gray-50 { --tw-gradient-to: #f9fafb; }
        
        /* Flexbox */
        .flex { display: flex; }
        .flex-wrap { flex-wrap: wrap; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .justify-end { justify-content: flex-end; }
        .flex-1 { flex: 1 1 0%; }
        .flex-shrink-0 { flex-shrink: 0; }
        .space-x-1 > * + * { margin-left: 0.25rem; }
        .space-x-2 > * + * { margin-left: 0.5rem; }

        /* Grid */
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gap-4 { gap: 1rem; }
        .gap-x-6 { column-gap: 1.5rem; }
        .gap-y-1 { row-gap: 0.25rem; }
        
        /* Badges coloridos para situações */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.125rem 0.625rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            border: 1px solid;
        }

        /* Cores específicas dos badges - alinhadas com getBadgeColor do sistema */
        .badge-green {
            background-color: #dcfce7;
            color: #166534;
            border-color: #bbf7d0;
        }

        .badge-red {
            background-color: #fee2e2;
            color: #991b1b;
            border-color: #fecaca;
        }

        .badge-yellow {
            background-color: #fef3c7;
            color: #92400e;
            border-color: #fde68a;
        }

        .badge-blue {
            background-color: #dbeafe;
            color: #1e40af;
            border-color: #bfdbfe;
        }

        .badge-purple {
            background-color: #f3e8ff;
            color: #7c3aed;
            border-color: #d8b4fe;
        }

        .badge-gray {
            background-color: #f3f4f6;
            color: #374151;
            border-color: #e5e7eb;
        }
        
        /* Estilos para textos truncados */
        .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* Shadow utilities */
        .shadow-sm {
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        /* Scroll utilities */
        .scroll-mt-6 {
            scroll-margin-top: 1.5rem;
        }

        /* Opacity */
        .opacity-50 {
            opacity: 0.5;
        }
        
        /* Estilos responsivos básicos */
        @media (min-width: 768px) {
            .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        
        /* Estilos de impressão para melhor qualidade */
        @media print {
            /* Configuração geral da página */
            @page {
                margin: 1.5cm 1cm;
                size: A4;
            }

            body {
                background-color: white !important;
                font-size: 10pt;
                line-height: 1.4;
                color: #000;
            }

            /* Container principal */
            .report-container {
                max-width: 100%;
                padding: 0;
            }

            /* Preservar cores de fundo importantes */
            .bg-gray-50,
            .bg-gray-100 {
                background-color: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .bg-white {
                background-color: white !important;
            }

            /* Ajustar títulos para impressão */
            h1, h2 {
                font-size: 16pt;
                margin-top: 12pt;
                margin-bottom: 8pt;
                page-break-after: avoid;
            }

            h3 {
                font-size: 14pt;
                margin-top: 10pt;
                margin-bottom: 6pt;
                page-break-after: avoid;
            }

            h4 {
                font-size: 12pt;
                margin-top: 8pt;
                margin-bottom: 4pt;
                page-break-after: avoid;
            }

            /* Controle de quebras de página - Cards individuais */
            .verba-container {
                page-break-inside: auto;
                break-inside: auto;
                margin-bottom: 20pt;
            }

            .verba-container:not(:last-child) {
                page-break-after: auto;
                break-after: auto;
            }

            .lancamento-item {
                page-break-inside: avoid;
                break-inside: avoid;
                margin-bottom: 6pt;
                padding: 6pt;
            }

            .decision-card,
            .documento-card {
                page-break-inside: avoid;
                break-inside: avoid;
                margin-bottom: 4pt;
                padding: 6pt;
            }

            /* Cabeçalhos de seção devem ficar com conteúdo */
            .verba-header {
                page-break-after: avoid;
                break-after: avoid;
            }

            .verba-header + .lancamentos-list {
                page-break-before: avoid;
                break-before: avoid;
            }

            /* Permitir quebra natural de lista de lançamentos */
            .lancamentos-list {
                page-break-inside: auto;
                break-inside: auto;
            }

            /* Cabeçalhos de seção principais devem ficar com seu conteúdo */
            #decisoes > div:first-child,
            #documentos > div:first-child,
            #verbas > div:first-child {
                page-break-after: avoid;
                break-after: avoid;
            }

            /* Container de padding interno pode quebrar naturalmente */
            #decisoes .p-4,
            #documentos .p-4,
            #verbas .p-4 {
                page-break-inside: auto;
                break-inside: auto;
            }

            /* Seções principais podem quebrar naturalmente */
            #decisoes,
            #documentos,
            #verbas {
                page-break-inside: auto !important;
                break-inside: auto !important;
            }

            /* Controle de órfãos e viúvas para melhor fluxo */
            .decision-card,
            .documento-card,
            .lancamento-item {
                orphans: 2;
                widows: 2;
            }

            p {
                orphans: 2;
                widows: 2;
            }

            /* Reduzir espaçamentos excessivos */
            .space-y-6 > * + * { margin-top: 10pt; }
            .space-y-4 > * + * { margin-top: 6pt; }
            .space-y-3 > * + * { margin-top: 5pt; }
            .space-y-2 > * + * { margin-top: 3pt; }
            .space-y-1 > * + * { margin-top: 2pt; }

            .p-6 { padding: 10pt; }
            .p-5 { padding: 8pt; }
            .p-4 { padding: 10pt; }
            .py-4 { padding-top: 6pt; padding-bottom: 6pt; }
            .px-6 { padding-left: 10pt; padding-right: 10pt; }
            .px-5 { padding-left: 8pt; padding-right: 8pt; }

            .mb-6 { margin-bottom: 15pt; }
            .mb-4 { margin-bottom: 6pt; }
            .mb-3 { margin-bottom: 5pt; }
            .mb-2 { margin-bottom: 3pt; }
            .mt-6 { margin-top: 6pt; }
            .mt-4 { margin-top: 4pt; }
            .mt-8 { margin-top: 16pt; }

            /* Melhorar contraste de texto */
            .text-gray-900 { color: #000 !important; }
            .text-gray-700 { color: #333 !important; }
            .text-gray-600 { color: #555 !important; }
            .text-gray-500 { color: #666 !important; }

            /* Preservar cores de badges */
            .badge,
            .badge-green,
            .badge-red,
            .badge-yellow,
            .badge-blue,
            .badge-purple,
            .badge-gray {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                border: 1pt solid !important;
            }

            /* Simplificar sombras - remover para impressão */
            .shadow-sm,
            .shadow-md,
            .shadow-lg {
                box-shadow: none !important;
            }

            /* Borders mais visíveis */
            .border {
                border-width: 1pt !important;
            }

            .border-b {
                border-bottom-width: 1pt !important;
            }

            .border-t {
                border-top-width: 1pt !important;
            }

            .border-l-4 {
                border-left-width: 3pt !important;
            }

            /* Ajustar gradientes para cores sólidas */
            .bg-gradient-to-r,
            .bg-gradient-to-br {
                background: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Preservar cores de destaque específicas */
            [style*="background-color: #f0fdf4"] { /* Verde claro */
                background-color: #f0fdf4 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            [style*="background-color: #fef2f2"] { /* Vermelho claro */
                background-color: #fef2f2 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            [style*="background-color: #fffbeb"] { /* Amarelo claro */
                background-color: #fffbeb !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            [style*="background-color: #eff6ff"] { /* Azul claro */
                background-color: #eff6ff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Garantir legibilidade de conteúdo formatado */
            .formatted-content {
                font-size: 10pt;
                line-height: 1.5;
            }

            .formatted-content p {
                margin: 4pt 0;
            }

            .formatted-content ul,
            .formatted-content ol {
                margin: 4pt 0;
                padding-left: 20pt;
            }

            /* Ajustar tamanho de texto para impressão */
            .text-xl { font-size: 14pt; }
            .text-lg { font-size: 12pt; }
            .text-base { font-size: 10pt; }
            .text-sm { font-size: 9pt; }
            .text-xs { font-size: 8pt; }

            /* Reduzir espaçamento de ícones/badges circulares */
            .rounded-full {
                padding: 2pt 6pt;
            }

            /* Garantir que secoes de conteudo principal sejam impressas */
            #decisoes,
            #documentos,
            #verbas {
                page-break-before: auto;
            }

            /* Cabecalho de secao para impressao */
            .section-header {
                background: #fafafa !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .section-icon {
                width: 30pt;
                height: 30pt;
                background-color: #f3f4f6 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .section-icon svg {
                width: 16pt;
                height: 16pt;
            }

            /* Links devem ser sublinhados na impressão */
            a {
                text-decoration: underline;
                color: #000 !important;
            }

            /* Remover efeitos hover (não fazem sentido na impressão) */
            *:hover {
                background-color: inherit !important;
            }

            /* Ocultar elementos interativos que não fazem sentido na impressão */
            button,
            .no-print {
                display: none !important;
            }

            /* Remover sombras e efeitos visuais desnecessários */
            .hover\\:bg-gray-100,
            .hover\\:bg-gray-200,
            .hover\\:shadow-md,
            .transition-colors,
            .transition-shadow,
            .transition-all {
                transition: none !important;
            }

            /* Otimizar badges inline para economizar espaço */
            .inline-flex {
                display: inline !important;
            }

            /* Ajustar numeração e índices para melhor legibilidade */
            .w-6.h-6,
            .w-8.h-8 {
                width: auto !important;
                height: auto !important;
                min-width: 18pt;
                min-height: 18pt;
                padding: 2pt 6pt;
            }
        }
        
        /* Estilos específicos para o relatório */
        .report-container {
            max-width: 1024px;
            margin: 0 auto;
            padding: 0 1.5rem;
        }
        
        .process-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .verba-container {
            margin-bottom: 1.5rem;
        }

        /* Fix: Espaçamento específico para lançamentos */
        .lancamento-item {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 0.5rem;
        }

        /* Fix: Espacamento para secoes de decisoes e documentos */
        .decision-card,
        .documento-card {
            margin-bottom: 0.5rem;
        }

        /* Estilo para icones representados como texto */
        .icon {
            font-family: monospace;
            font-size: 0.75rem;
            color: #6b7280;
            margin-right: 0.5rem;
        }

        /* Cabecalho de secao elegante */
        .section-header {
            background: linear-gradient(to right, #fafafa, #ffffff);
        }

        .section-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background-color: #f3f4f6;
            border-radius: 10px;
            flex-shrink: 0;
        }

        .section-icon svg {
            width: 20px;
            height: 20px;
        }
        
        /* Estilos para conteúdo HTML formatado - CORRIGIDO */
        .formatted-content {
          display: block;
          margin-top: 0.25rem;
        }

        .formatted-content p {
          margin: 0.5rem 0;
          line-height: 1.625;
        }

        .formatted-content p:first-child {
          margin-top: 0;
        }

        .formatted-content p:last-child {
          margin-bottom: 0;
        }

        .formatted-content ul, .formatted-content ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          line-height: 1.625;
        }

        .formatted-content li {
          margin: 0.25rem 0;
        }

        .formatted-content strong {
          font-weight: 600;
        }

        .formatted-content em {
          font-style: italic;
        }

        .formatted-content u {
          text-decoration: underline;
        }

        .formatted-content a {
          color: #2563eb;
          text-decoration: underline;
        }

        .formatted-content a:hover {
          color: #1d4ed8;
        }

        /* Fix: Classes adicionais para textos */
        .leading-relaxed {
          line-height: 1.625;
        }

        .inline-flex {
          display: inline-flex;
        }
        
        {{HEADER_FOOTER_STYLES}}
    </style>
</head>
<body>
    {{HEADER}}
    
    <div class="report-container">
        {{CONTENT}}
    </div>
    
    {{FOOTER}}
</body>
</html>`;

/**
 * Classe para gerenciar templates HTML
 *
 * Responsável por aplicar dados nos templates e gerar HTML final.
 * Agora integra com sistema de cabeçalho e rodapé personalizado,
 * mantendo separação de responsabilidades e facilidade de manutenção.
 */
class HTMLTemplate {

  /**
   * Gera HTML completo aplicando dados no template
   * 
   * Integra cabeçalho e rodapé personalizados com o conteúdo principal,
   * aplicando todas as substituições necessárias de forma coordenada.
   * 
   * @param title - Título do documento HTML
   * @param content - Conteúdo HTML do relatório
   * @param options - Opções adicionais para personalização
   * @returns String com HTML completo pronto para exportação
   */
  static generateCompleteHTML(
    title: string, 
    content: string, 
    options: {
      includeHeaderFooter?: boolean;
      documentId?: string;
    } = {}
  ): string {
    // Data atual formatada para exibição
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Configuração padrão: incluir cabeçalho e rodapé
    const includeHeaderFooter = options.includeHeaderFooter !== false;
    
    // Gera cabeçalho e rodapé se solicitado
    let headerHTML = '';
    let footerHTML = '';
    let headerFooterStyles = '';
    
    if (includeHeaderFooter) {
      headerHTML = HTMLHeaderFooter.generateHeader();
      footerHTML = HTMLHeaderFooter.generateFooter();
      headerFooterStyles = HTMLHeaderFooter.generateHeaderFooterStyles();
      
      // Aplica substituições nos placeholders do cabeçalho e rodapé
      headerHTML = HTMLHeaderFooter.replacePlaceholders(headerHTML, {
        exportDate: currentDate,
        documentId: options.documentId
      });
      
      footerHTML = HTMLHeaderFooter.replacePlaceholders(footerHTML, {
        exportDate: currentDate,
        documentId: options.documentId
      });
    }
    
    // Aplica todas as substituições no template principal
    return HTML_BASE_TEMPLATE
      .replace('{{TITLE}}', title)
      .replace('{{CONTENT}}', content)
      .replace('{{HEADER}}', headerHTML)
      .replace('{{FOOTER}}', footerHTML)
      .replace('{{HEADER_FOOTER_STYLES}}', headerFooterStyles)
      .replace('{{EXPORT_DATE}}', currentDate);
  }
  
  /**
   * Gera template para informações do processo
   * 
   * @param numeroProcesso - Número do processo
   * @param reclamante - Nome da parte autora
   * @param reclamada - Nome da parte ré
   * @param dataCriacao - Data de criação do processo
   * @param ultimaAtualizacao - Data da última atualização
   * @returns HTML formatado para informações do processo
   */
  static generateProcessInfoHTML(
    numeroProcesso: string,
    reclamante: string,
    reclamada: string,
    dataCriacao: string,
    ultimaAtualizacao?: string
  ): string {
    return `
      <div class="mb-6 pb-6 border-b border-gray-200">
        <h3 class="text-base font-medium text-gray-900 mb-3">Processo Analisado</h3>
        <div class="space-y-2 text-sm">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div>
              <span class="text-gray-600">Número:</span>
              <span class="ml-2 text-gray-900 font-mono">${numeroProcesso}</span>
            </div>
            <div>
              <span class="text-gray-600">Criado em:</span>
              <span class="ml-2 text-gray-900">${dataCriacao}</span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div>
              <span class="text-gray-600">Parte Autora:</span>
              <span class="ml-2 text-gray-900">${reclamante}</span>
            </div>
            <div>
              <span class="text-gray-600">Parte Re:</span>
              <span class="ml-2 text-gray-900">${reclamada}</span>
            </div>
          </div>
          ${ultimaAtualizacao ? `
          <div class="pt-2">
            <span class="text-gray-600">Última atualização:</span>
            <span class="ml-2 text-gray-900">${ultimaAtualizacao}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Gera badge colorido baseado na situação
   *
   * @param situacao - Situação do lançamento
   * @returns HTML do badge com classes CSS apropriadas
   */
  static generateSituacaoBadge(situacao: string): string {
    let badgeClass = 'badge-gray'; // Classe padrão

    switch (situacao) {
      case 'Deferida':
        badgeClass = 'badge-green';
        break;
      case 'Indeferida':
      case 'Excluída':
        badgeClass = 'badge-red';
        break;
      case 'Parcialmente Deferida':
        badgeClass = 'badge-yellow';
        break;
      case 'Reformada':
        badgeClass = 'badge-blue';
        break;
      case 'Em Análise':
      case 'Aguardando Documentação':
        badgeClass = 'badge-purple';
        break;
    }

    return `<span class="badge ${badgeClass}">${situacao}</span>`;
  }

  /**
   * Extrai apenas os estilos CSS do template base
   *
   * Este método extrai todo o CSS do template HTML_BASE_TEMPLATE,
   * incluindo estilos customizados do cabeçalho/rodapé se solicitado.
   *
   * @param includeHeaderFooterStyles - Se true, inclui estilos do cabeçalho/rodapé
   * @returns String contendo apenas o CSS extraído (sem tags <style>)
   */
  static extractStyles(includeHeaderFooterStyles: boolean = false): string {
    let styles = '';

    const styleMatch = HTML_BASE_TEMPLATE.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch && styleMatch[1]) {
      styles = styleMatch[1];
    }

    if (includeHeaderFooterStyles) {
      const headerFooterStyles = HTMLHeaderFooter.generateHeaderFooterStyles();
      styles = styles.replace('{{HEADER_FOOTER_STYLES}}', headerFooterStyles);
    } else {
      styles = styles.replace('{{HEADER_FOOTER_STYLES}}', '');
    }

    return styles;
  }

  /**
   * Gera fragmento HTML otimizado para conversão em PDF via html2pdf.js
   *
   * Este método resolve o problema de PDFs em branco gerados pelo html2pdf.js.
   *
   * IMPORTANTE: html2pdf.js requer um fragmento HTML (não documento completo).
   * Quando você insere um documento HTML completo (<!DOCTYPE html><html><head>...)
   * em element.innerHTML, o navegador descarta as tags estruturais e os estilos
   * no <head>, resultando em conteúdo sem CSS.
   *
   * Este método retorna um fragmento HTML que inclui:
   * - Tag <style> com todos os estilos CSS inline
   * - Conteúdo do relatório dentro de <div class="report-container">
   * - SEM tags <html>, <head>, <body> (que seriam descartadas pelo innerHTML)
   *
   * @param content - Conteúdo HTML do relatório
   * @param options - Opções de geração
   * @returns Fragmento HTML pronto para usar com html2pdf.js
   */
  static generateContentForPDF(
    content: string,
    options: {
      includeHeaderFooter?: boolean;
    } = {}
  ): string {
    const styles = this.extractStyles(options.includeHeaderFooter || false);

    return `<style>${styles}</style>
<div class="report-container">
  ${content}
</div>`;
  }
}

export default HTMLTemplate;