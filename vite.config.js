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
        categories: htmlEntry("./categories.html"),
        login: htmlEntry("./login.html"),
        userHome: htmlEntry("./user/index.html"),
        userCart: htmlEntry("./user/cart.html"),
        userOrders: htmlEntry("./user/orders.html"),
        userCache: htmlEntry("./user/cache.html")
      }
    }
  }
});
