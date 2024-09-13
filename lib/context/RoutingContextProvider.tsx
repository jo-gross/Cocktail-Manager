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
    const url = `${pathname}?${searchParams}`;
    setPreviousRoute(currentRoute);
    setCurrentRoute(url);
  }, [pathname, searchParams]);

  return (
    <RoutingContext.Provider
      value={{
        conditionalBack: async (fallbackUrl: string) => {
          if (previousRoute == null || previousRoute == currentRoute) {
            console.log('Fallback');
            await router.replace(fallbackUrl);
          } else if (previousRoute != currentRoute) {
            console.log('Back');
            router.back();
          } else {
            alert('no routing');
          }
        },
      }}
    >
      {children}
    </RoutingContext.Provider>
  );
}
