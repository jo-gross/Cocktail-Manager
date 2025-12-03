export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DEPLOYMENT: 'test' | 'development' | 'production' | 'staging';
      DISABLE_WORKSPACE_CREATION?: string;
      WORKSPACE_CREATION_DISABLED_MESSAGE?: string;
    }
  }
}
