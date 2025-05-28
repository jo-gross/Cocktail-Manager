export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DEPLOYMENT: 'test' | 'development' | 'production' | 'staging';
    }
  }
}
