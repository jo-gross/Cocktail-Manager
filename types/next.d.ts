// types/next.d.ts (oder types.ts o.ä.)
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';

// Jede Seite (NextPage) darf optional eine `pullToRefresh`-Funktion exportieren:
export type NextPageWithPullToRefresh<P = {}, IP = P> = NextPage<P, IP> & {
  pullToRefresh?: () => void | Promise<void>;
};

// Und den AppProps-Typ entsprechend erweitern:
export type AppPropsWithPullToRefresh = AppProps & {
  Component: NextPageWithPullToRefresh;
};
