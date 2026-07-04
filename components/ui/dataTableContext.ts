import { createContext, useContext } from 'react';

export const DataTableContext = createContext(false);

export function useDataTableContext(): boolean {
  return useContext(DataTableContext);
}
