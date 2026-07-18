import type { PropsWithChildren } from 'react';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
