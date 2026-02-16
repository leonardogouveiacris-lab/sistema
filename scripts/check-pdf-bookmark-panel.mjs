import fs from 'node:fs';
import path from 'node:path';

const componentPath = path.join(process.cwd(), 'src/components/pdf/PDFBookmarkPanel.tsx');
const source = fs.readFileSync(componentPath, 'utf8');

const requiredCollect = 'const isExpanded = expandAll || expandedItems.has(bookmarkId);';
const requiredRender = 'const isExpanded = expandedItems.has(bookmarkId) || expandAll;';

if (source.includes('isDocumentGroupBookmark')) {
  throw new Error('PDFBookmarkPanel ainda referencia isDocumentGroupBookmark.');
}

if (!source.includes(requiredCollect)) {
  throw new Error(`Lógica esperada não encontrada em collectVisibleBookmarks: ${requiredCollect}`);
}

if (!source.includes(requiredRender)) {
  throw new Error(`Lógica esperada não encontrada em renderBookmarkRow: ${requiredRender}`);
}

const multiDocBookmarks = [
  {
    title: 'Documento 1',
    items: [
      { title: 'Capítulo 1', pageNumber: 1, items: [] },
      { title: 'Capítulo 2', pageNumber: 2, items: [] }
    ]
  },
  {
    title: 'Documento 2',
    items: [
      { title: 'Seção A', pageNumber: 10, items: [] }
    ]
  }
];

const collectVisibleBookmarkIds = (bookmarks, expandAll, expandedItems, level = 0, prefix = '', output = []) => {
  bookmarks.forEach((bookmark, index) => {
    const bookmarkId = `${prefix}${index}`;
    output.push({ bookmarkId, level, title: bookmark.title });

    const hasChildren = Array.isArray(bookmark.items) && bookmark.items.length > 0;
    const isExpanded = expandAll || expandedItems.has(bookmarkId);

    if (hasChildren && isExpanded) {
      collectVisibleBookmarkIds(bookmark.items, expandAll, expandedItems, level + 1, `${bookmarkId}-`, output);
    }
  });

  return output;
};

const collapsed = collectVisibleBookmarkIds(multiDocBookmarks, false, new Set());
if (collapsed.length !== 2) {
  throw new Error(`Esperava 2 itens visíveis com tudo recolhido, obtive ${collapsed.length}.`);
}

const oneExpanded = collectVisibleBookmarkIds(multiDocBookmarks, false, new Set(['0']));
if (oneExpanded.length !== 4) {
  throw new Error(`Esperava 4 itens visíveis com apenas Documento 1 expandido, obtive ${oneExpanded.length}.`);
}

const allExpanded = collectVisibleBookmarkIds(multiDocBookmarks, true, new Set());
if (allExpanded.length !== 5) {
  throw new Error(`Esperava 5 itens visíveis com expandAll=true, obtive ${allExpanded.length}.`);
}

console.log('PDFBookmarkPanel smoke check passed (multi-doc bookmarks, sem helper externo).');
