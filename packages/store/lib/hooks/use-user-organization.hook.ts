import { useMemo } from 'react';

import type { Organization } from '@extension/shared';

import { useGetOrganizationByIdQuery } from '../store/index.js';

export const useUserOrganization = (): {
  fields: Organization | undefined;
  isLoading: boolean;
  isError: boolean;
} => {
  const { isLoading, isError, data } = useGetOrganizationByIdQuery();

  return useMemo(() => ({ isLoading, isError, fields: data }), [data, isError, isLoading]);
};
