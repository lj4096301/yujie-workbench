import { default as React } from 'react';
interface WeatherIconProps {
    code: number;
    isDay?: number;
    className?: string;
    size?: number;
    strokeWidth?: number;
}
export declare const WeatherIcon: React.FC<WeatherIconProps>;
export {};
