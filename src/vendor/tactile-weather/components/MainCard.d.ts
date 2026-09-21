import { default as React } from 'react';
import { WeatherData } from '../types';
import { Language } from '../constants/translations';
interface MainCardProps {
    data: WeatherData | null;
    loading: boolean;
    unit: 'C' | 'F';
    size?: 'large' | 'medium' | 'small' | 'mini' | 'wide-small' | 'wide-medium' | 'micro';
    locationName?: string;
    lang: Language;
}
export declare const MainCard: React.FC<MainCardProps>;
export {};
