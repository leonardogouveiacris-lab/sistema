import Quill from 'quill';

const Embed = Quill.import('blots/embed') as any;

interface LancamentoRefValue {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  paginaVinculada?: number;
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

    const icon = value.type === 'verba' ? '⬡' : value.type === 'decisao' ? '◈' : '⬜';
    const label = value.sublabel
      ? `${value.label} · ${value.sublabel}`
      : value.label;
    const page = value.paginaVinculada ? ` p.${value.paginaVinculada}` : '';
    node.textContent = `${icon} ${label}${page}`;

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
    };
  }
}

let registered = false;

export function registerLancamentoRefBlot(): void {
  if (registered) return;
  registered = true;
  Quill.register(LancamentoRefBlot);
}
