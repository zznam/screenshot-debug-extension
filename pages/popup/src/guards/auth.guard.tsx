import type { PropsWithChildren } from 'react';

import { AuthMethod } from '@extension/shared';
import { useUser } from '@extension/store';

import { AuthView, Skeleton } from '../components/ui';

export const AuthGuard: React.FC<PropsWithChildren> = ({ children }) => {
  return <>{children}</>;
};
