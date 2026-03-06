const TOKEN_CORE_CHAR_RE = /[\p{L}\p{N}]/u;
const TOKEN_CONNECTORS = new Set(['.', '-', ',', '/']);

export function isCoreTokenChar(char: string): boolean {
  return TOKEN_CORE_CHAR_RE.test(char);
}

export function isConnectorChar(char: string): boolean {
  return TOKEN_CONNECTORS.has(char);
}

export function isTokenChar(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;

  const char = text[index];
  if (isCoreTokenChar(char)) {
    return true;
  }

  if (!isConnectorChar(char)) {
    return false;
  }

  return isCoreTokenChar(text[index - 1] || '') && isCoreTokenChar(text[index + 1] || '');
}
