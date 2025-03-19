'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface PopoverContextType {
  isDynamicTableOpen: boolean;
  setIsDynamicTableOpen: (isOpen: boolean) => void;
}

const PopoverContext = createContext<PopoverContextType | undefined>(undefined);

export function PopoverProvider({ children }: { children: ReactNode }) {
  const [isDynamicTableOpen, setIsDynamicTableOpen] = useState(false);

  return (
    <PopoverContext.Provider value={{ isDynamicTableOpen, setIsDynamicTableOpen }}>
      {children}
    </PopoverContext.Provider>
  );
}

export function usePopover() {
  const context = useContext(PopoverContext);
  if (context === undefined) {
    throw new Error('usePopover must be used within a PopoverProvider');
  }
  return context;
}
