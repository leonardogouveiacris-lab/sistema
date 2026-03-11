type DateValue = Date | string | number;

interface SortByPaginaOptions<T> {
  getDataCriacao?: (item: T) => DateValue;
  newestFirst?: boolean;
}

interface ItemComPagina {
  paginaVinculada?: number | null;
}

export const sortByPagina = <T extends ItemComPagina>(
  a: T,
  b: T,
  options: SortByPaginaOptions<T> = {}
): number => {
  const {
    getDataCriacao = (item: T) => (item as T & { dataCriacao: DateValue }).dataCriacao,
    newestFirst = true,
  } = options;

  const aTemPagina = a.paginaVinculada != null;
  const bTemPagina = b.paginaVinculada != null;

  if (aTemPagina && bTemPagina) {
    return a.paginaVinculada - b.paginaVinculada;
  }

  if (aTemPagina) return -1;
  if (bTemPagina) return 1;

  const aData = new Date(getDataCriacao(a)).getTime();
  const bData = new Date(getDataCriacao(b)).getTime();

  return newestFirst ? bData - aData : aData - bData;
};

