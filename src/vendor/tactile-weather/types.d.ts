export interface DailyForecast {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
}
export interface CurrentWeather {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
    is_day: number;
}
export interface HourlyWeather {
    relative_humidity_2m: number[];
    apparent_temperature: number[];
    time: string[];
}
export interface WeatherData {
    current_weather: CurrentWeather;
    daily: DailyForecast;
    hourly: HourlyWeather;
    timezone: string;
}
export interface Location {
    name: string;
    lat: number;
    lon: number;
    country?: string;
    admin1?: string;
}
export interface GeocodingResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
}
export interface GeocodingResponse {
    results?: GeocodingResult[];
}
