/**
 * On the web, the frontend is served by the same Express server as the API,
 * so a relative "/api" path works fine.
 *
 * In the Capacitor mobile app, the frontend loads from capacitor://localhost
 * (Android) or a similar native scheme — there's no backend at that origin,
 * so this MUST point to your real deployed backend URL instead.
 *
 * Leave this as "/api" for local web development. Before building the mobile
 * app, change AURA_API_BASE_URL below to your deployed backend, e.g.:
 *   window.AURA_API_BASE_URL = "https://your-backend.onrender.com/api";
 */
window.AURA_API_BASE_URL = "https://ai-assistant-kappa-virid.vercel.app/api";
