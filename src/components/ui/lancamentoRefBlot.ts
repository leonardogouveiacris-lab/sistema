import Quill from 'quill';

const Embed = Quill.import('blots/embed') as any;

interface LancamentoRefValue {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  paginaVinculada?: number;
  tableColumnLetter?: string;
  tableName?: string;
}

class LancamentoRefBlot extends Embed {
  static blotName = 'lancamentoRef';
  static tagName = 'span';
  static className = 'lancamento-ref-chip';

  static create(value: LancamentoRefValue): HTMLElement {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-ref', 'lancamento');
    node.setAttribute('data-id', value.id);
    node.setAttribute('data-type', value.type);
    node.setAttribute('contenteditable', 'false');

    if (value.type === 'tabela') {
      const colLetter = value.tableColumnLetter || value.sublabel || '';
      node.textContent = `⊞ Col. ${colLetter}`;
      if (value.tableColumnLetter) {
        node.setAttribute('data-column-letter', value.tableColumnLetter);
      }
      if (value.tableName) {
        node.setAttribute('data-table-name', value.tableName);
      }
    } else {
      const icon = value.type === 'verba' ? '⬡' : value.type === 'decisao' ? '◈' : '⬜';
      const label = value.sublabel
        ? `${value.label} · ${value.sublabel}`
        : value.label;
      const page = value.paginaVinculada ? ` p.${value.paginaVinculada}` : '';
      node.textContent = `${icon} ${label}${page}`;
    }

    if (value.paginaVinculada !== undefined) {
      node.setAttribute('data-pagina', String(value.paginaVinculada));
    }
    if (value.sublabel) {
      node.setAttribute('data-sublabel', value.sublabel);
    }
    node.setAttribute('data-label', value.label);

    return node;
  }

  static value(node: HTMLElement): LancamentoRefValue {
    return {
      id: node.getAttribute('data-id') || '',
      type: node.getAttribute('data-type') || '',
      label: node.getAttribute('data-label') || node.textContent || '',
      sublabel: node.getAttribute('data-sublabel') || undefined,
      paginaVinculada: node.getAttribute('data-pagina')
        ? Number(node.getAttribute('data-pagina'))
        : undefined,
      tableColumnLetter: node.getAttribute('data-column-letter') || undefined,
      tableName: node.getAttribute('data-table-name') || undefined,
    };
  }
}

let registered = false;

export function registerLancamentoRefBlot(): void {
  if (registered) return;
  registered = true;
  Quill.register(LancamentoRefBlot);
}
