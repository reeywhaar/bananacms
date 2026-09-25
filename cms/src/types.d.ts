// Ambient types for sites: add "@reeywhaar/bananacms/types" to `compilerOptions.types`.
/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />

// `server-only` is resolved by @vitejs/plugin-rsc, which fails the build when
// client code imports it; this declares the module for TypeScript.
declare module 'server-only'
