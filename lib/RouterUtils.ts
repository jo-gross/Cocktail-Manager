import { NextRouter } from 'next/router';

export const routerConditionalBack = async (router: NextRouter, fallbackUrl: string) => {
  if (window.history.length > 1) {
    router.back();
  } else {
    await router.replace(fallbackUrl);
  }
};
