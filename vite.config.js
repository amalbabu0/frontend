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
        cache: htmlEntry("./cache.html")
      }
    }
  }
});
