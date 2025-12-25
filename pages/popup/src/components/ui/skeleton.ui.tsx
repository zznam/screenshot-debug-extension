import { Skeleton as SkeletonComponent } from '@extension/ui';

export const Skeleton = () => (
  <div className="relative px-5 pb-5 pt-4">
    <div className="items-center space-y-6 md:flex md:justify-between md:space-x-4 md:space-y-0">
      <div className="flex justify-between">
        <SkeletonComponent className="h-8 w-[120px]" />

        <div className="flex space-x-2">
          <SkeletonComponent className="size-8" />
          <SkeletonComponent className="size-8" />
        </div>
      </div>

      <div className="grid space-y-4">
        <SkeletonComponent className="size-20 w-full rounded-lg" />

        <SkeletonComponent className="m-auto h-6 w-[120px]" />

        <div className="space-y-1.5">
          <SkeletonComponent className="m-auto h-3 w-[180px]" />
          <SkeletonComponent className="m-auto h-3 w-[250px]" />
        </div>
      </div>
    </div>
  </div>
);
