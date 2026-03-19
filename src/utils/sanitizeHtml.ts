const ALLOWED_TAGS = new Set([
  'b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li',
  'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 's', 'strike'
]);

const ALLOWED_ATTRS = new Set(['class', 'style']);

function sanitizeNode(node: Element): void {
  const childNodes = Array.from(node.childNodes);

  for (const child of childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) {
          fragment.appendChild(el.firstChild);
        }
        node.replaceChild(fragment, el);
        sanitizeNode(node);
        return;
      }

      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(attrName)) {
          el.removeAttribute(attr.name);
        } else if (attrName === 'style') {
          const safeStyle = attr.value
            .split(';')
            .filter(rule => {
              const prop = rule.split(':')[0].trim().toLowerCase();
              return !prop.includes('expression') && !prop.includes('url') && !prop.includes('behavior');
            })
            .join(';');
          el.setAttribute('style', safeStyle);
        }
      }

      sanitizeNode(el);
    }
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  const div = document.createElement('div');
  div.innerHTML = html;

  sanitizeNode(div);

  return div.innerHTML;
}
