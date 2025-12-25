'use client';

import type React from 'react';

interface ApiHealthProviderProps {
  children: React.ReactNode;
  checkInterval?: number;
}

export const ApiHealthProvider = ({ children }: ApiHealthProviderProps) => {
  return <>{children}</>;
};
