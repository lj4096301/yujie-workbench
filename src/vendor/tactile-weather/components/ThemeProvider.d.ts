import { default as React } from 'react';
export type ThemeMode = 'light' | 'dark';
export interface ThemeConfig {
    [key: string]: string;
}
export interface ThemeProviderProps {
    children: React.ReactNode;
    initialTheme?: ThemeMode;
    customTheme?: ThemeConfig;
}
export declare const ThemeProvider: React.FC<ThemeProviderProps>;
export declare const useTheme: () => any;
