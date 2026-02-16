/**
 * Configurações e templates para cabeçalho e rodapé dos relatórios HTML
 * 
 * Este arquivo centraliza todas as configurações visuais do cabeçalho e rodapé
 * dos relatórios exportados, replicando exatamente o design fornecido na imagem.
 * Separado do template principal para melhor organização e escalabilidade.
 */

/**
 * Configurações do cabeçalho do relatório
 * Baseado na imagem fornecida - layout limpo e profissional
 */
export const HEADER_CONFIG = {
  // URL do logo da empresa (ícone + texto calculopro)
  LOGO_URL: 'https://calculopro.com.br/wp-content/uploads/2024/11/logonegativa.png',
  
  // Texto alternativo para acessibilidade
  LOGO_ALT: 'ProViewer - Sistema de Relatorios de Liquidacao',
  
  // Informações de contato (lado direito do cabeçalho)
  CONTACT_INFO: {
    name: 'Leonardo G. Cristiano',
    phone: '(14) 99606-7654',
    email: 'contato@calculopro.com.br'
  },
  
  // Altura máxima do logo em pixels
  LOGO_HEIGHT: '40px'
} as const;

/**
 * Configurações do rodapé do relatório
 * Mantém informações institucionais simples
 */
export const FOOTER_CONFIG = {
  // Informações da empresa (baseadas na imagem fornecida)
  EMPRESA_NOME: 'CalculoPro Ltda.',
  CNPJ: '51.540.075/0001-04',
  
  // Endereço completo da empresa
  ENDERECO: {
    rua: 'R. Mário Gonzaga Junqueira, 25-80',
    bairro: 'Jardim Viaduto',
    cidade: 'Bauru',
    estado: 'SP',
    cep: '17055-210'
  },
  
  // Website da empresa
  WEBSITE: 'www.calculopro.com.br'
} as const;

/**
 * Classe para geração de cabeçalho e rodapé HTML
 * Responsável por criar os elementos visuais baseados na imagem de referência
 */
export class HTMLHeaderFooter {
  
  /**
   * Gera o HTML do cabeçalho do relatório
   * 
   * Replica exatamente o design da imagem fornecida:
   * - Logo da CalculoPro à esquerda
   * - Informações de contato (nome, telefone, email) à direita
   * - Fundo branco limpo
   * - Layout responsivo
   * 
   * @returns String com HTML completo do cabeçalho
   */
  static generateHeader(): string {
    return `
      <!-- Cabeçalho do Relatório - Baseado na imagem fornecida -->
      <header class="header-relatorio" style="
        background: white;
        border-bottom: 1px solid #e5e7eb;
        padding: 20px 0;
        margin-bottom: 30px;
      ">
        <div style="
          max-width: 1024px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        ">
          <!-- Seção do Logo (lado esquerdo) -->
          <div style="
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 200px;
          ">
            <!-- Logo da CalculoPro -->
            <img 
              src="${HEADER_CONFIG.LOGO_URL}" 
              alt="${HEADER_CONFIG.LOGO_ALT}"
              style="
                max-height: ${HEADER_CONFIG.LOGO_HEIGHT};
                width: auto;
                object-fit: contain;
              "
              onerror="this.style.display='none'"
            />
          </div>
          
          <!-- Informações de Contato (lado direito) -->
          <div style="
            text-align: right;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #374151;
            line-height: 1.4;
            min-width: 250px;
          ">
            <!-- Nome do responsável -->
            <div style="
              font-weight: bold;
              margin-bottom: 2px;
            ">
              ${HEADER_CONFIG.CONTACT_INFO.name}
            </div>
            
            <!-- Telefone -->
            <div style="
              margin-bottom: 2px;
            ">
              Tel: ${HEADER_CONFIG.CONTACT_INFO.phone}
            </div>
            
            <!-- Email -->
            <div>
              ${HEADER_CONFIG.CONTACT_INFO.email}
            </div>
          </div>
        </div>
      </header>
    `;
  }
  
  /**
   * Gera o HTML do rodapé do relatório
   * 
   * Replica exatamente o design da imagem fornecida com:
   * - Endereço completo à esquerda
   * - CNPJ da empresa à direita
   * - Website centralizado abaixo
   * 
   * @returns String com HTML completo do rodapé
   */
  static generateFooter(): string {
    // Formata o endereço completo da empresa
    const enderecoCompleto = `${FOOTER_CONFIG.ENDERECO.rua}, ${FOOTER_CONFIG.ENDERECO.bairro}, ${FOOTER_CONFIG.ENDERECO.cidade} - ${FOOTER_CONFIG.ENDERECO.estado}, ${FOOTER_CONFIG.ENDERECO.cep}`;
    
    return `
      <!-- Rodapé do Relatório -->
      <footer style="
        border-top: 1px solid #e5e7eb;
        margin-top: 40px;
        padding: 20px 0;
        background-color: #f9fafb;
        color: #6b7280;
        font-size: 0.875rem;
        font-family: Arial, sans-serif;
      ">
        <div style="
          max-width: 1024px;
          margin: 0 auto;
          padding: 0 1.5rem;
        ">
          <!-- Linha principal - Endereço e CNPJ -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 20px;
          ">
            <!-- Seção esquerda - Endereço completo -->
            <div>
              <!-- Endereço linha 1: Rua -->
              <div style="margin-bottom: 4px;">
                ${FOOTER_CONFIG.ENDERECO.rua}
              </div>
              
              <!-- Endereço linha 2: Bairro, Cidade, Estado, CEP -->
              <div style="margin-bottom: 8px;">
                ${FOOTER_CONFIG.ENDERECO.bairro}, ${FOOTER_CONFIG.ENDERECO.cidade} - ${FOOTER_CONFIG.ENDERECO.estado}, ${FOOTER_CONFIG.ENDERECO.cep}
              </div>
              
              <!-- Website -->
              <div>
                <a href="https://${FOOTER_CONFIG.WEBSITE}" 
                   target="_blank" 
                   style="color: #3b82f6; text-decoration: none;">
                  ${FOOTER_CONFIG.WEBSITE}
                </a>
              </div>
            </div>
            
            <!-- Seção direita - CNPJ da empresa -->
            <div style="
              text-align: right;
              font-weight: 500;
            ">
              ${FOOTER_CONFIG.EMPRESA_NOME} ${FOOTER_CONFIG.CNPJ}
            </div>
          </div>
        </div>
      </footer>
    `;
  }
  
  /**
   * Gera estilos CSS específicos para cabeçalho e rodapé
   * 
   * Estilos adicionais para garantir boa apresentação em diferentes
   * contextos (impressão, visualização, responsividade)
   * 
   * @returns String com CSS específico para cabeçalho e rodapé
   */
  static generateHeaderFooterStyles(): string {
    return `
      /* Estilos específicos para cabeçalho e rodapé */
      
      /* Responsividade para dispositivos móveis */
      @media (max-width: 768px) {
        .header-relatorio div[style*="display: flex"] {
          flex-direction: column !important;
          text-align: center !important;
        }
        
        .header-relatorio div[style*="text-align: right"] {
          text-align: center !important;
        }
      }
      
      /* Estilos para impressão */
      @media print {
        .header-relatorio {
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          padding: 10pt 0 !important;
          margin-bottom: 15pt !important;
          border-bottom: 1pt solid #e5e7eb !important;
        }

        footer {
          background-color: #f9fafb !important;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          padding: 10pt 0 !important;
          margin-top: 20pt !important;
          border-top: 1pt solid #e5e7eb !important;
          font-size: 8pt !important;
        }

        /* Evita quebra de página no cabeçalho e rodapé */
        header, footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* Ajustar tamanho do logo para impressão */
        .header-relatorio img {
          max-height: 30pt !important;
        }

        /* Ajustar informações de contato para impressão */
        .header-relatorio div[style*="text-align: right"] {
          font-size: 9pt !important;
          line-height: 1.3 !important;
        }

        /* Otimizar rodapé para impressão */
        footer div {
          font-size: 8pt !important;
        }

        footer a {
          color: #000 !important;
          text-decoration: none !important;
        }
      }
      
      /* Melhora a legibilidade dos links */
      footer a:hover {
        color: #1d4ed8 !important;
        text-decoration: underline !important;
      }
    `;
  }
  
  /**
   * Substitui placeholders dinâmicos no cabeçalho e rodapé
   * 
   * Permite personalizar informações dinâmicas como data de geração
   * e ID do documento. Simplificado para o novo layout do rodapé.
   * 
   * @param html - HTML com placeholders a serem substituídos
   * @param data - Objeto com dados para substituição
   * @returns HTML com placeholders substituídos
   */
  static replacePlaceholders(
    html: string, 
    data: {
      exportDate: string;
      documentId?: string;
    }
  ): string {
    const currentYear = new Date().getFullYear();
    const docId = data.documentId || `DOC_${Date.now()}`;
    
    return html
      .replace(/\{\{EXPORT_DATE\}\}/g, data.exportDate)
      .replace(/\{\{CURRENT_YEAR\}\}/g, currentYear.toString())
      .replace(/\{\{DOC_ID\}\}/g, docId);
  }
}

export default HTMLHeaderFooter;