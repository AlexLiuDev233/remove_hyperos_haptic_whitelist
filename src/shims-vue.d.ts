declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module '*.css';

declare module 'miuix-vue' {
  export type ThemeMode = 'system' | 'light' | 'dark';
  export type SnackbarDuration = 'short' | 'long' | 'indefinite' | number;
  export type SnackbarResult = 'dismissed' | 'action';

  export interface SnackbarOptions {
    message: string;
    actionLabel?: string;
    withDismissAction?: boolean;
    duration?: SnackbarDuration;
  }

  export const MiuixButton: any;
  export const MiuixBasicComponent: any;
  export const MiuixCard: any;
  export const MiuixDialog: any;
  export const MiuixIcon: any;
  export const MiuixIconButton: any;
  export const MiuixInput: any;
  export const MiuixScrollArea: any;
  export const MiuixSearchBar: any;
  export const MiuixSmallTitle: any;
  export const MiuixSnackbarHost: any;
  export const MiuixSurface: any;
  export const MiuixText: any;
  export const MiuixTopAppBar: any;
  export function setThemeMode(next: ThemeMode): void;
  export function showSnackbar(options: SnackbarOptions): Promise<SnackbarResult>;
}

declare module 'miuix-vue/icons' {
  export const Refresh: any;
}

declare const __APP_VERSION__: string;
