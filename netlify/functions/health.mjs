// /api/health : tells the browser whether the house tools are connected to GHL. Never returns secrets.
import { json, liveMode } from "./_lib/house.mjs";

export default async () => json({
  mode: liveMode() ? "ghl" : "demo",
  configured: {
    apiKey: !!process.env.GHL_API_KEY,
    location: !!process.env.GHL_LOCATION_ID,
    secret: !!process.env.SESSION_SECRET,
    community: !!process.env.GHL_COMMUNITY_URL
  }
});
