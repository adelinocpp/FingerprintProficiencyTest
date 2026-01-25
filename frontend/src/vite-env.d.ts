/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEFAULT_LANGUAGE: string;
  readonly VITE_MAX_IMAGE_SIZE: string;
  readonly VITE_IMAGE_QUALITY: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_SESSION_TIMEOUT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
