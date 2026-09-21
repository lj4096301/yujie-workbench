import { default as React } from 'react';
import { WeatherData, Location } from '../types';
import { Language } from '../constants/translations';
interface WeatherWidgetProps {
    size: 'large' | 'medium' | 'small' | 'mini' | 'wide-small' | 'wide-medium' | 'micro';
    data: WeatherData | null;
    loading: boolean;
    unit: 'C' | 'F';
    locationName: string;
    onToggleUnit: () => void;
    onRefresh: () => void;
    onLocationSelect?: (location: Location) => void;
    lang: Language;
}
export declare const WeatherWidget: React.FC<WeatherWidgetProps>;
export {};
