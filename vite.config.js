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
        accountDevices: htmlEntry("./account/devices/index.html"),
        sellerHome: htmlEntry("./seller/index.html"),
        sellerRegister: htmlEntry("./seller/register/index.html"),
        sellerProducts: htmlEntry("./seller/products/index.html"),
        sellerOrders: htmlEntry("./seller/orders/index.html"),
        sellerAccount: htmlEntry("./seller/account/index.html"),
        publicCart: htmlEntry("./cart/index.html"),
        orderSummary: htmlEntry("./cart/summary/index.html"),
        login: htmlEntry("./login/index.html"),
        product: htmlEntry("./product/index.html"),
        payment: htmlEntry("./payment/index.html"),
        userHome: htmlEntry("./user/index.html"),
        userCart: htmlEntry("./user/cart/index.html"),
        userOrders: htmlEntry("./user/orders/index.html"),
        userCache: htmlEntry("./user/cache/index.html")
      }
    }
  }
});
