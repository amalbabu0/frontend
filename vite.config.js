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
        analytics: htmlEntry("./analytics.html"),
        userHome: htmlEntry("./user/index.html"),
        userCart: htmlEntry("./user/cart.html"),
        userOrders: htmlEntry("./user/orders.html"),
        ownerHome: htmlEntry("./owner/index.html"),
        ownerInventory: htmlEntry("./owner/inventory.html"),
        ownerCache: htmlEntry("./owner/cache.html"),
        adminHome: htmlEntry("./admin/index.html"),
        adminOrders: htmlEntry("./admin/orders.html"),
        adminCache: htmlEntry("./admin/cache.html"),
        developmentHome: htmlEntry("./development/index.html"),
        developmentSoc: htmlEntry("./development/soc.html"),
        developmentSystem: htmlEntry("./development/system.html"),
        developmentWebAnalytics: htmlEntry("./development/web-analytics.html"),
        developmentSpeedInsights: htmlEntry("./development/speed-insights.html"),
        developmentObservability: htmlEntry("./development/observability.html"),
        developmentAnalytics: htmlEntry("./development/analytics.html")
      }
    }
  }
});