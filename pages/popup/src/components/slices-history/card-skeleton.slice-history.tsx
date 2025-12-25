import { Skeleton } from '@extension/ui';

export const CardSkeleton = () => {
  return (
    <div className="my-4 flex items-center space-x-4">
      <Skeleton className="size-12 rounded-sm" />

      <div className="space-y-2">
        <Skeleton className="h-3 w-[250px]" />
        <Skeleton className="h-3 w-[200px]" />
      </div>

      <Skeleton className="size-5 rounded-sm" />
    </div>
  );
};
