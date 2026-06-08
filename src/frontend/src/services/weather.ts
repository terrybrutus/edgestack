import { CONFIG } from "./config";

export interface GameWeather {
  tempF: number;
  windSpeedMph: number;
  windDirection: string; // "N", "NE", "E", etc.
  windDeg: number;
  description: string;
  precipChance: number; // 0-100
  totalSignal: "OVER" | "UNDER" | "NEUTRAL";
  totalImpact: string;
}

// MLB stadium coordinates keyed by partial venue name (lowercase match).
// Using names avoids relying on MLB Stats API venue IDs which are undocumented.
const STADIUM_COORDS: Array<{
  match: string; // substring of venue.name (lowercase)
  lat: number;
  lon: number;
  cfDeg: number;
  indoor?: boolean; // retractable roofs / domes → weather irrelevant
}> = [
  { match: "coors", lat: 39.756, lon: -104.994, cfDeg: 180 },
  { match: "great american", lat: 39.097, lon: -84.507, cfDeg: 200 },
  { match: "fenway", lat: 42.346, lon: -71.097, cfDeg: 90 },
  { match: "wrigley", lat: 41.948, lon: -87.655, cfDeg: 90 },
  { match: "petco", lat: 32.707, lon: -117.157, cfDeg: 315 },
  { match: "oracle", lat: 37.778, lon: -122.389, cfDeg: 270 },
  { match: "dodger", lat: 34.074, lon: -118.24, cfDeg: 270 },
  { match: "t-mobile", lat: 47.591, lon: -122.332, cfDeg: 270 },
  { match: "comerica", lat: 42.339, lon: -83.049, cfDeg: 0 },
  { match: "guaranteed rate", lat: 41.83, lon: -87.634, cfDeg: 180 },
  { match: "minute maid", lat: 29.757, lon: -95.355, cfDeg: 0, indoor: true },
  { match: "camden yards", lat: 39.284, lon: -76.622, cfDeg: 315 },
  { match: "oriole park", lat: 39.284, lon: -76.622, cfDeg: 315 },
  { match: "yankee", lat: 40.829, lon: -73.926, cfDeg: 0 },
  { match: "progressive", lat: 41.496, lon: -81.685, cfDeg: 180 },
  { match: "pnc park", lat: 40.447, lon: -80.006, cfDeg: 90 },
  { match: "busch", lat: 38.623, lon: -90.193, cfDeg: 90 },
  { match: "kauffman", lat: 39.052, lon: -94.48, cfDeg: 0 },
  { match: "target field", lat: 44.982, lon: -93.278, cfDeg: 270 },
  { match: "american family", lat: 43.028, lon: -87.971, cfDeg: 180 },
  { match: "globe life", lat: 32.751, lon: -97.083, cfDeg: 0, indoor: true },
  {
    match: "american league",
    lat: 25.778,
    lon: -80.22,
    cfDeg: 0,
    indoor: true,
  }, // loanDepot
  { match: "loandepot", lat: 25.778, lon: -80.22, cfDeg: 0, indoor: true },
  { match: "tropicana", lat: 27.768, lon: -82.653, cfDeg: 0, indoor: true },
  { match: "chase field", lat: 33.446, lon: -112.067, cfDeg: 0, indoor: true },
  { match: "sutter health", lat: 38.586, lon: -121.5, cfDeg: 270 },
  { match: "oakland", lat: 37.752, lon: -122.201, cfDeg: 270 },
  { match: "citizens bank", lat: 39.906, lon: -75.166, cfDeg: 0 },
  { match: "truist park", lat: 33.891, lon: -84.468, cfDeg: 90 },
  { match: "rogers centre", lat: 43.641, lon: -79.389, cfDeg: 0, indoor: true },
  { match: "nationals park", lat: 38.873, lon: -77.007, cfDeg: 0 },
  { match: "citi field", lat: 40.757, lon: -73.846, cfDeg: 270 },
];

const DIR_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function degToDir(deg: number): string {
  return DIR_NAMES[Math.round(deg / 45) % 8];
}

export async function fetchStadiumWeather(
  venueName: string,
  date: string, // "YYYY-MM-DD"
): Promise<GameWeather | null> {
  const lower = venueName.toLowerCase();
  const stadium = STADIUM_COORDS.find((s) => lower.includes(s.match));
  if (!stadium) return null;
  if (stadium.indoor) return null; // indoor/retractable dome — weather irrelevant

  const url = `${CONFIG.WEATHER_BASE}/forecast?latitude=${stadium.lat}&longitude=${stadium.lon}&daily=precipitation_probability_max,windspeed_10m_max,winddirection_10m_dominant,temperature_2m_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FNew_York&start_date=${date}&end_date=${date}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();

  const daily = json.daily;
  if (!daily) return null;

  const tempF = daily.temperature_2m_max?.[0] ?? 72;
  const windMph = daily.windspeed_10m_max?.[0] ?? 0;
  const windDeg = daily.winddirection_10m_dominant?.[0] ?? 0;
  const precipChance = daily.precipitation_probability_max?.[0] ?? 0;
  const windDir = degToDir(windDeg);

  // Determine if wind is blowing toward or away from CF
  const angleToCf = Math.abs((windDeg - stadium.cfDeg + 360) % 360);
  const windOutToCf = angleToCf < 45; // wind blowing OUT toward CF
  const windInFromCf = angleToCf > 135 && angleToCf < 225; // wind blowing IN from CF

  let totalSignal: GameWeather["totalSignal"] = "NEUTRAL";
  let totalImpact = "";

  if (windMph >= 15 && windOutToCf) {
    totalSignal = "OVER";
    totalImpact = `Wind ${windMph}mph blowing OUT to CF — ball carries, lean OVER`;
  } else if (windMph >= 15 && windInFromCf) {
    totalSignal = "UNDER";
    totalImpact = `Wind ${windMph}mph blowing IN from CF — suppresses fly balls, lean UNDER`;
  } else if (windMph >= 10 && windOutToCf) {
    totalSignal = "OVER";
    totalImpact = `Moderate wind ${windMph}mph out to CF — mild over lean`;
  } else if (tempF >= 85) {
    totalSignal = "OVER";
    totalImpact = `Hot ${tempF}°F — ball carries better in warm air, slight over lean`;
  } else if (tempF <= 50) {
    totalSignal = "UNDER";
    totalImpact = `Cold ${tempF}°F — dense air suppresses ball flight, slight under lean`;
  } else {
    totalImpact = `${tempF}°F, wind ${windMph}mph ${windDir} — neutral conditions`;
  }

  return {
    tempF,
    windSpeedMph: windMph,
    windDirection: windDir,
    windDeg,
    description: `${tempF}°F, ${windMph}mph ${windDir}${precipChance > 30 ? `, ${precipChance}% rain` : ""}`,
    precipChance,
    totalSignal,
    totalImpact,
  };
}
