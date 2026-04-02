import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface TableViewerState {
  isOpen: boolean;
  isMinimized: boolean;
  processId: string | null;
}

interface TableViewerContextType {
  state: TableViewerState;
  openTableViewer: (processId: string) => void;
  closeTableViewer: () => void;
  toggleMinimize: () => void;
}

const TableViewerContext = createContext<TableViewerContextType | null>(null);

export function TableViewerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TableViewerState>({
    isOpen: false,
    isMinimized: false,
    processId: null,
  });

  const openTableViewer = useCallback((processId: string) => {
    setState({ isOpen: true, isMinimized: false, processId });
  }, []);

  const closeTableViewer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, isMinimized: false }));
  }, []);

  const toggleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const value = useMemo(
    () => ({ state, openTableViewer, closeTableViewer, toggleMinimize }),
    [state, openTableViewer, closeTableViewer, toggleMinimize]
  );

  return (
    <TableViewerContext.Provider value={value}>
      {children}
    </TableViewerContext.Provider>
  );
}

export function useTableViewer() {
  const ctx = useContext(TableViewerContext);
  if (!ctx) throw new Error('useTableViewer must be used inside TableViewerProvider');
  return ctx;
}
