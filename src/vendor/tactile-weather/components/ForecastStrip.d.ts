import { default as React } from 'react';
import { WeatherData } from '../types';
import { Language } from '../constants/translations';
interface ForecastStripProps {
    data: WeatherData | null;
    unit: 'C' | 'F';
    lang: Language;
}
export declare const ForecastStrip: React.FC<ForecastStripProps>;
export {};
