/**
 * Text Formatter Utility
 *
 * Funções para formatação de texto extraído de PDFs,
 * substituindo quebras de linha por espaços para evitar
 * concatenação de palavras.
 */

function isLikelyWordFragment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;

  const lastChar = trimmed[trimmed.length - 1].toLowerCase();

  const validWordEndings = /[aeiouáéíóúàèìòùâêîôûãõs]$/i;
  if (validWordEndings.test(trimmed)) {
    return false;
  }

  const validConsonantEndings = ['r', 'l', 'm', 'z', 'x', 'n'];
  if (validConsonantEndings.includes(lastChar)) {
    return false;
  }

  if (trimmed.length >= 4) {
    const lastTwo = trimmed.slice(-2).toLowerCase();
    if (['ns', 'is', 'os', 'as', 'es', 'us', 'ão', 'õe', 'ões'].includes(lastTwo)) {
      return false;
    }
  }

  return true;
}

function isLikelySuffix(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 1) return false;

  const suffixPatterns = [
    /^(ado|ada|ados|adas|ido|ida|idos|idas)(\b|$)/,
    /^(ando|endo|indo)(\b|$)/,
    /^(ável|ível|aveis|iveis)(\b|$)/,
    /^(mente)(\b|$)/,
    /^(ção|ções|são|sões)(\b|$)/,
    /^(izado|izada|izados|izadas)(\b|$)/,
    /^(oso|osa|osos|osas)(\b|$)/,
    /^(eiro|eira|eiros|eiras)(\b|$)/,
    /^(ista|istas)(\b|$)/,
    /^(dade|dades)(\b|$)/,
    /^(mento|mentos)(\b|$)/,
    /^[oaei]($|\s|[.,;:!?])/,
  ];

  return suffixPatterns.some(pattern => pattern.test(trimmed));
}

function shouldAddSpaceBetween(prevText: string, nextText: string): boolean {
  if (!prevText || !nextText) return false;

  const lastCharOfPrev = prevText[prevText.length - 1];
  const firstCharOfNext = nextText[0];

  if (/\s/.test(lastCharOfPrev) || /\s/.test(firstCharOfNext)) {
    return false;
  }

  if (lastCharOfPrev === '-') {
    return false;
  }

  if (isLikelyWordFragment(prevText) && /^[a-zà-ÿ]/.test(firstCharOfNext)) {
    return false;
  }

  if (isLikelySuffix(nextText) && /[a-zA-ZÀ-ÿ]/.test(lastCharOfPrev)) {
    return false;
  }

  if (/[.,;:!?]/.test(lastCharOfPrev) && /[a-zA-ZÀ-ÿ0-9]/.test(firstCharOfNext)) {
    return true;
  }

  if (/[a-zA-ZÀ-ÿ0-9]/.test(lastCharOfPrev) && /[a-zA-ZÀ-ÿ0-9]/.test(firstCharOfNext)) {
    return true;
  }

  return false;
}

/**
 * Extrai texto de uma Selection do navegador, adicionando espaços
 * entre os nós de texto apenas onde apropriado.
 *
 * PDF.js renderiza cada fragmento de texto como um span separado.
 * Esta função usa heurísticas para determinar quando adicionar espaços:
 * - Não adiciona espaço se já houver whitespace na fronteira
 * - Não adiciona espaço se o texto anterior parecer um fragmento de palavra
 * - Adiciona espaço entre palavras completas
 *
 * @param selection - Objeto Selection do navegador
 * @returns Texto extraído com espaços adequados entre palavras
 */
export function extractTextFromSelection(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const textParts: string[] = [];

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const fragment = range.cloneContents();
    const walker = document.createTreeWalker(
      fragment,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode()) !== null) {
      const text = node.textContent || '';
      if (text) {
        textParts.push(text);
      }
    }
  }

  if (textParts.length === 0) return '';

  let result = textParts[0];

  for (let i = 1; i < textParts.length; i++) {
    const current = textParts[i];

    if (shouldAddSpaceBetween(result, current)) {
      result += ' ' + current;
    } else {
      result += current;
    }
  }

  return formatPDFText(result);
}

/**
 * Substitui todas as quebras de linha por espaços.
 *
 * @param text - Texto bruto extraído do PDF com quebras de linha
 * @returns Texto formatado com espaços no lugar das quebras de linha
 *
 * @example
 * const rawText = "Requer a parte Reclamante que o feito tramite\nperante o juízo 100% digital";
 * const formatted = formatPDFText(rawText);
 * // Resultado: "Requer a parte Reclamante que o feito tramite perante o juízo 100% digital"
 */
export function formatPDFText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let formattedText = text
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return formattedText;
}

/**
 * Opções de configuração para formatação de texto
 */
export interface TextFormatterOptions {
  joinHyphenatedWords?: boolean;
}

/**
 * Versão avançada do formatador com opções configuráveis
 *
 * @param text - Texto a ser formatado
 * @param options - Opções de formatação
 * @returns Texto formatado
 */
export function formatPDFTextAdvanced(
  text: string,
  options: TextFormatterOptions = {}
): string {
  const { joinHyphenatedWords = true } = options;

  if (!text || typeof text !== 'string') {
    return '';
  }

  let formattedText = text;

  if (joinHyphenatedWords) {
    formattedText = formattedText.replace(/-\s*\n\s*/g, '');
  }

  return formatPDFText(formattedText);
}

export default {
  extractTextFromSelection,
  formatPDFText,
  formatPDFTextAdvanced
};
