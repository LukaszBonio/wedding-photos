/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Google Apps Script Web App URL (ends with /exec). */
  readonly VITE_GAS_URL: string;
  /** Static upload token, mirrored in the GAS Script Properties. */
  readonly VITE_UPLOAD_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
