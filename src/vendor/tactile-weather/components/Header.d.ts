import { default as React } from 'react';
import { Location } from '../types';
import { Language } from '../constants/translations';
interface HeaderProps {
    locationName: string;
    unit: 'C' | 'F';
    onToggleUnit: () => void;
    onRefresh: () => void;
    onLocationSelect?: (location: Location) => void;
    size?: 'large' | 'medium' | 'small' | 'mini' | 'wide-small' | 'wide-medium' | 'micro';
    lang: Language;
}
export declare const Header: React.FC<HeaderProps>;
export {};
