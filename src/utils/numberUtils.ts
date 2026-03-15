export function normalizeNumberString(str: string): string {
  const dotIdx = str.lastIndexOf('.');
  const commaIdx = str.lastIndexOf(',');

  if (dotIdx === -1 && commaIdx === -1) return str;

  if (dotIdx !== -1 && commaIdx === -1) {
    const dotCount = (str.match(/\./g) ?? []).length;
    if (dotCount > 1) return str.replace(/\./g, '');
    if (str.length - dotIdx - 1 === 3 && !str.startsWith('-0')) return str.replace(/\./g, '');
    return str;
  }

  if (commaIdx !== -1 && dotIdx === -1) {
    const commaCount = (str.match(/,/g) ?? []).length;
    if (commaCount > 1) return str.replace(/,/g, '');
    if (str.length - commaIdx - 1 === 3) return str.replace(/,/g, '');
    return str.replace(',', '.');
  }

  if (dotIdx < commaIdx) return str.replace(/\./g, '').replace(',', '.');
  return str.replace(/,/g, '');
}
