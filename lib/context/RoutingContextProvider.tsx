'use client';

import { createContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { usePathname, useSearchParams } from 'next/navigation';

export const RoutingContext = createContext<{ conditionalBack: (fallbackUrl: string) => Promise<void> }>({
  conditionalBack: async () => {},
});

export function RoutingContextProvider({ children }: { children: JSX.Element }) {
  const router = useRouter();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [currentRoute, setCurrentRoute] = useState<string | null>(null);
  const [previousRoute, setPreviousRoute] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = pathname && `${pathname}`;
    if (url) {
      if (searchParams != null && searchParams.size > 0) {
        url = url + '?' + searchParams.toString();
      }
    }

    setPreviousRoute(currentRoute);
    setCurrentRoute(url);
  }, [pathname, searchParams]);

  return (
    <RoutingContext.Provider
      value={{
        conditionalBack: async (fallbackUrl: string) => {
          if (
            previousRoute == null ||
            currentRoute == null ||
            previousRoute == currentRoute ||
            (previousRoute && currentRoute && previousRoute.includes(currentRoute))
          ) {
            await router.replace(fallbackUrl);
          } else if (previousRoute == currentRoute) {
            await router.replace(fallbackUrl);
          } else if (previousRoute != currentRoute) {
            router.back();
          } else {
            console.error('no routing condition');
            console.log('Referrer: ', document.referrer);
            console.log('Current', currentRoute);
            console.log('Previous', previousRoute);
            await router.replace(fallbackUrl);
          }
        },
      }}
    >
      {children}
    </RoutingContext.Provider>
  );
}
