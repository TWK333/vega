export type MoodWeatherId =
  | "sparkle_sun"
  | "sun"
  | "partly_cloudy"
  | "breeze"
  | "cloudy"
  | "drizzle"
  | "rain"
  | "thunder";

export const MOOD_WEATHERS: Record<MoodWeatherId, { label: string }> = {
  sparkle_sun: { label: "晴空万里" },
  sun: { label: "晴" },
  partly_cloudy: { label: "多云转晴" },
  breeze: { label: "微风" },
  cloudy: { label: "阴" },
  drizzle: { label: "小雨" },
  rain: { label: "雨" },
  thunder: { label: "雷阵雨" },
};

export function isMoodWeather(value: unknown): value is MoodWeatherId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MOOD_WEATHERS, value);
}
