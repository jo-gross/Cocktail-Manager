import React from 'react';
import { Card, CardBody, Skeleton } from '@components/ui';

interface CocktailRecipeCardSkeletonProps {
  showImage?: boolean;
}

function StepSkeletons() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="ml-2 h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="ml-2 h-4 w-3/5" />
        <Skeleton className="ml-2 h-4 w-1/2" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="ml-2 h-4 w-1/2" />
      </div>
    </div>
  );
}

/** Loading placeholder that mirrors the CompactCocktailRecipeInstruction layout. */
export function CocktailRecipeCardSkeleton({ showImage = false }: CocktailRecipeCardSkeletonProps) {
  return (
    <Card variant="elevated" className="h-full flex-row">
      <CardBody className="w-full">
        <div className="grid grid-cols-4 gap-1">
          <Skeleton className="col-span-2 h-7 w-4/5" />
          <Skeleton className="col-span-2 h-7 w-16 justify-self-end" />

          <Skeleton className="row-span-2 h-16 w-12 justify-self-center rounded-lg" />

          <div className="col-span-3 flex flex-row justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>

          <div className="col-span-4 border-b border-base-100" />

          {showImage ? (
            <div className="col-span-4 grid grid-cols-5 gap-1">
              <div className="col-span-3">
                <StepSkeletons />
              </div>
              <Skeleton className="col-span-2 aspect-9/16 w-full rounded-xl" />
            </div>
          ) : (
            <div className="col-span-4">
              <StepSkeletons />
            </div>
          )}

          <div className="col-span-4 mt-1 flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
