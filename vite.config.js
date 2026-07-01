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
        categories: htmlEntry("./categories/index.html"),
        account: htmlEntry("./account/index.html"),
        publicCart: htmlEntry("./cart/index.html"),
        login: htmlEntry("./login/index.html"),
        product: htmlEntry("./product/index.html"),
        userHome: htmlEntry("./user/index.html"),
        userCart: htmlEntry("./user/cart/index.html"),
        userOrders: htmlEntry("./user/orders/index.html"),
        userCache: htmlEntry("./user/cache/index.html")
      }
    }
  }
});
