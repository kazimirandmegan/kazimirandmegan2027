/** Open-Meteo weather code → emoji/label */
export const WXC = {
  0: ["☀️", "Clear skies"],
  1: ["🌤", "Mostly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫", "Fog"],
  48: ["🌫", "Freezing fog"],
  51: ["🌦", "Light drizzle"],
  53: ["🌦", "Drizzle"],
  55: ["🌧", "Heavy drizzle"],
  61: ["🌧", "Light rain"],
  63: ["🌧", "Rain"],
  65: ["🌧", "Heavy rain"],
  66: ["🌧", "Freezing rain"],
  67: ["🌧", "Freezing rain"],
  71: ["🌨", "Light snow"],
  73: ["🌨", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["🌨", "Snow grains"],
  80: ["🌦", "Light showers"],
  81: ["🌦", "Showers"],
  82: ["⛈", "Heavy showers"],
  85: ["🌨", "Snow showers"],
  86: ["🌨", "Snow showers"],
  95: ["⛈", "Thunderstorm"],
  96: ["⛈", "Thunder & hail"],
  99: ["⛈", "Thunder & hail"],
};

export const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=51.755&longitude=-0.336&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon";
