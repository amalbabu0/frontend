import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const htmlEntry = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        home: htmlEntry("./index.html"),
        login: htmlEntry("./login.html"),
        cart: htmlEntry("./cart.html"),
        orders: htmlEntry("./orders.html"),
        cache: htmlEntry("./cache.html"),
        user: htmlEntry("./user.html"),
        owner: htmlEntry("./owner.html"),
        admin: htmlEntry("./admin.html"),
        monitoring: htmlEntry("./monitoring.html"),
        soc: htmlEntry("./soc.html"),
        system: htmlEntry("./system.html"),
        webAnalytics: htmlEntry("./web-analytics.html"),
        speedInsights: htmlEntry("./speed-insights.html"),
        observability: htmlEntry("./observability.html"),
        analytics: htmlEntry("./analytics.html")
      }
    }
  }
});
