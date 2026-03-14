import React, { createContext, useContext, useState, useCallback } from 'react';

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

  return (
    <TableViewerContext.Provider value={{ state, openTableViewer, closeTableViewer, toggleMinimize }}>
      {children}
    </TableViewerContext.Provider>
  );
}

export function useTableViewer() {
  const ctx = useContext(TableViewerContext);
  if (!ctx) throw new Error('useTableViewer must be used inside TableViewerProvider');
  return ctx;
}
