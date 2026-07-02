import React, { createContext, useContext } from 'react';

// Create a context with an any type since we are passing down complex aggregated state
// In a stricter TypeScript implementation, we would define the full interface here.
export const DashboardContext = createContext<any>(null);

export const DashboardProvider = ({ children, value }: { children: React.ReactNode, value: any }) => {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};
