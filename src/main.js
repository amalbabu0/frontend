import { hasSupabaseConfig, supabase } from "./lib/supabase.js";
import "./app.css";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const app = document.querySelector("#app");
const page = document.body.dataset.page || "home";
const protectedPages = new Set(["cart", "orders", "cache", "user", "owner", "admin", "monitoring", "soc", "system", "webAnalytics", "speedInsights", "observability", "analytics"]);
const monitoringPages = new Set(["monitoring", "soc", "system", "webAnalytics", "speedInsights", "observability", "analytics"]);

const state = {
  authReady: false,
  authMode: "signin",
  email: "",
  password: "",
  session: null,
  products: [],
  cart: [],
  orders: [],
  cache: null,
  health: null,
  productCache: null,
  message: "",
  messageType: "info",
  filters: {
    query: "",
    category: "all",
    status: "all",
    sort: "featured"
  },
  loading: {
    auth: false,
    products: false,
    cart: false,
    orders: false,
    cache: false,
    health: false,
    action: ""
  }
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR"
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const fallbackImages = [
  "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=900&q=80"
];

const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => escapeMap[char]);
}

function formatMoney(paise) {
  return moneyFormatter.format(Number(paise || 0) / 100);
}

function formatDate(value) {
  if (!value) {
    return "Pending";
  }

  return dateFormatter.format(new Date(value));
}

function ttlLabel(ttlSeconds) {
  if (ttlSeconds === -1) {
    return "No expiry";
  }
  if (ttlSeconds === -2) {
    return "Missing";
  }
  if (ttlSeconds === undefined || ttlSeconds === null) {
    return "Unknown";
  }
  return `${ttlSeconds}s TTL`;
}

function isSignedIn() {
  return Boolean(state.session?.access_token);
}

function currentUserEmail() {
  return state.session?.user?.email || "";
}

function authHeaders() {
  return state.session?.access_token
    ? { Authorization: `Bearer ${state.session.access_token}` }
    : {};
}

function setMessage(text, type = "info") {
  state.message = text;
  state.messageType = type;
  render();
}

function clearMessage() {
  state.message = "";
  state.messageType = "info";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed.");
  }

  return data;
}

function enrichProduct(product, index) {
  const category = product.category || product.badge || "General";
  const seed = index + 1;
  return {
    ...product,
    category,
    badge: product.badge || category,
    image: product.image || fallbackImages[index % fallbackImages.length],
    alt: product.alt || `${product.name} product image`,
    rating: product.rating || (4.1 + ((seed % 8) * 0.1)).toFixed(1),
    stock: product.stock ?? 30 + (seed * 9) % 80,
    delivery: product.delivery || (seed % 2 === 0 ? "Tomorrow" : "Today"),
    channel: product.channel || (seed % 3 === 0 ? "Marketplace" : "Assured"),
    sku: product.sku || `SM-${String(seed).padStart(4, "0")}`,
    featured: product.featured ?? seed <= 4
  };
}

function categories() {
  return ["all", ...new Set(state.products.map((product) => product.category || "General"))];
}

function productById(productId) {
  return state.products.find((product) => product.id === productId);
}

function cartCount() {
  return state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function cartTotalPaise() {
  return state.cart.reduce((sum, item) => sum + Number(item.lineTotalPaise || item.pricePaise * item.quantity || 0), 0);
}

function orderTotalPaise() {
  return state.orders.reduce((sum, order) => sum + Number(order.totalPaise || 0), 0);
}

function cacheConfigured() {
  return Boolean(state.cache?.configured);
}

function productCacheLabel() {
  if (!state.productCache) {
    return "Loading";
  }
  if (state.productCache.hit) {
    return "Cache hit";
  }
  if (state.productCache.enabled === false) {
    return "Origin";
  }
  return "Cache miss";
}

function visibleProducts() {
  const query = state.filters.query.trim().toLowerCase();
  const filtered = state.products.filter((product) => {
    const text = [product.name, product.description, product.category, product.badge, product.sku]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesCategory = state.filters.category === "all" || product.category === state.filters.category;
    return matchesSearch && matchesCategory;
  });

  return filtered.sort((a, b) => {
    if (state.filters.sort === "price-low") {
      return a.pricePaise - b.pricePaise;
    }
    if (state.filters.sort === "price-high") {
      return b.pricePaise - a.pricePaise;
    }
    if (state.filters.sort === "rating") {
      return Number(b.rating) - Number(a.rating);
    }
    if (state.filters.sort === "stock") {
      return b.stock - a.stock;
    }
    return Number(b.featured) - Number(a.featured);
  });
}

function visibleOrders() {
  if (state.filters.status === "all") {
    return state.orders;
  }

  return state.orders.filter((order) => order.status === state.filters.status);
}

function cartPayload(items = state.cart) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity
  }));
}

async function loadProducts() {
  state.loading.products = true;
  render();
  try {
    const data = await apiRequest("/api/products");
    state.products = (data.products || []).map(enrichProduct);
    state.productCache = data.cache || {};
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.products = false;
    render();
  }
}

async function loadCart() {
  if (!isSignedIn()) {
    state.cart = [];
    return;
  }

  state.loading.cart = true;
  render();
  try {
    const data = await apiRequest("/api/cart");
    state.cart = data.cart || [];
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.cart = false;
    render();
  }
}

async function loadOrders() {
  if (!isSignedIn()) {
    state.orders = [];
    return;
  }

  state.loading.orders = true;
  render();
  try {
    const data = await apiRequest("/api/orders");
    state.orders = data.orders || [];
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.orders = false;
    render();
  }
}

async function loadCache() {
  if (!isSignedIn()) {
    state.cache = null;
    return;
  }

  state.loading.cache = true;
  render();
  try {
    state.cache = await apiRequest("/api/cache");
  } catch (error) {
    state.cache = { configured: false, message: error.message, keys: [] };
  } finally {
    state.loading.cache = false;
    render();
  }
}

async function loadHealth() {
  state.loading.health = true;
  render();
  try {
    state.health = await apiRequest("/health");
  } catch (error) {
    state.health = { ok: false, error: error.message };
  } finally {
    state.loading.health = false;
    render();
  }
}

async function loadPageData() {
  if (page === "home") {
    if (isSignedIn()) {
      await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache()]);
      return;
    }
    await loadProducts();
    return;
  }

  if (!isSignedIn()) {
    return;
  }

  if (page === "cart") {
    await Promise.all([loadProducts(), loadCart(), loadCache()]);
  }
  if (page === "orders") {
    await Promise.all([loadOrders(), loadCache()]);
  }
  if (page === "cache" || page === "user" || page === "owner" || page === "admin") {
    await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache()]);
  }
  if (monitoringPages.has(page)) {
    await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache(), loadHealth()]);
  }
}

async function saveCart(nextCart) {
  state.cart = nextCart;
  render();
  const data = await apiRequest("/api/cart", {
    method: "PUT",
    body: JSON.stringify({ items: cartPayload(nextCart) })
  });
  state.cart = data.cart || nextCart;
  await loadCache();
  render();
}

async function addToCart(productId, goToCart = false) {
  clearMessage();
  if (!isSignedIn()) {
    const nextUrl = goToCart ? "/user/cart.html" : "/index.html";
    window.location.href = `/login.html?next=${encodeURIComponent(nextUrl)}`;
    return;
  }
  const product = productById(productId);
  if (!product) {
    return;
  }

  const existing = state.cart.find((item) => item.productId === productId);
  const nextCart = existing
    ? state.cart.map((item) => {
        if (item.productId !== productId) {
          return item;
        }
        const quantity = Math.min(Number(item.quantity || 0) + 1, 20);
        return { ...item, quantity, lineTotalPaise: item.pricePaise * quantity };
      })
    : [
        ...state.cart,
        {
          productId: product.id,
          name: product.name,
          pricePaise: product.pricePaise,
          quantity: 1,
          lineTotalPaise: product.pricePaise
        }
      ];

  try {
    state.loading.action = productId;
    render();
    await saveCart(nextCart);
    if (goToCart) {
      window.location.href = "/user/cart.html";
      return;
    }
    setMessage(`${product.name} added to cart.`);
  } catch (error) {
    setMessage(error.message, "error");
    await loadCart();
  } finally {
    state.loading.action = "";
    render();
  }
}

async function updateQuantity(productId, direction) {
  clearMessage();
  const nextCart = state.cart
    .map((item) => {
      if (item.productId !== productId) {
        return item;
      }
      const quantity = Math.min(Math.max(Number(item.quantity || 0) + direction, 0), 20);
      return { ...item, quantity, lineTotalPaise: item.pricePaise * quantity };
    })
    .filter((item) => item.quantity > 0);

  try {
    state.loading.action = productId;
    render();
    await saveCart(nextCart);
  } catch (error) {
    setMessage(error.message, "error");
    await loadCart();
  } finally {
    state.loading.action = "";
    render();
  }
}

async function clearCart() {
  clearMessage();
  try {
    state.loading.action = "clear-cart";
    render();
    const data = await apiRequest("/api/cart", { method: "DELETE" });
    state.cart = data.cart || [];
    setMessage("Cart cleared.");
    await loadCache();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function submitOrder(status) {
  clearMessage();
  if (!state.cart.length) {
    setMessage("Cart is empty.", "error");
    return;
  }

  try {
    state.loading.action = status;
    render();
    const data = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: cartPayload(), status })
    });
    state.cart = [];
    setMessage(`${data.order.id} saved as ${data.order.status}.`);
    await Promise.all([loadOrders(), loadCache()]);
    if (status === "success") {
      window.location.href = "/user/orders.html";
    }
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function updateOrderStatus(orderId, status) {
  clearMessage();
  try {
    state.loading.action = orderId;
    render();
    const data = await apiRequest(`/api/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    setMessage(`${data.order.id} updated to ${data.order.status}.`);
    await Promise.all([loadOrders(), loadCache()]);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function runCacheAction(action) {
  clearMessage();
  try {
    state.loading.action = action;
    render();
    const data = await apiRequest("/api/cache", {
      method: "POST",
      body: JSON.stringify({ action })
    });
    state.cache = data;
    setMessage(data.message || "Cache updated.");
    await loadPageData();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function submitAuth() {
  clearMessage();
  if (!hasSupabaseConfig || !supabase) {
    setMessage("Supabase frontend env vars are missing.", "error");
    return;
  }

  state.loading.auth = true;
  render();
  try {
    const authCall = state.authMode === "signin"
      ? supabase.auth.signInWithPassword({ email: state.email, password: state.password })
      : supabase.auth.signUp({ email: state.email, password: state.password });
    const { data, error } = await authCall;
    if (error) {
      throw error;
    }

    state.session = data.session;
    state.password = "";
    if (!data.session) {
      setMessage("Account created. Check your email if confirmation is enabled.");
      return;
    }

    const nextUrl = new URLSearchParams(window.location.search).get("next") || "/user/index.html";
    window.location.href = nextUrl;
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.auth = false;
    render();
  }
}

async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  state.session = null;
  state.cart = [];
  state.orders = [];
  state.cache = null;
  state.health = null;
  window.location.href = "/login.html";
}

function renderMessage() {
  if (!state.message) {
    return "";
  }

  return `<div class="message ${state.messageType === "error" ? "error" : ""}" role="status">${escapeHtml(state.message)}</div>`;
}

function renderBoot() {
  return `
    <main class="boot-shell">
      <section class="boot-panel" aria-live="polite">
        <div class="brand-mark">S</div>
        <div>
          <h1>ScaleMart</h1>
          <p>Loading store.</p>
        </div>
      </section>
    </main>
  `;
}

function navLink(href, label, key) {
  return `<a class="nav-link ${page === key ? "active" : ""}" href="${href}">${label}</a>`;
}

function bottomNavLink(href, icon, label, key, badge = "") {
  return `
    <a class="bottom-nav-link ${page === key ? "active" : ""}" href="${href}" aria-label="${escapeHtml(label)}">
      <span class="bottom-nav-icon">${escapeHtml(icon)}</span>
      <span>${escapeHtml(label)}</span>
      ${badge ? `<strong>${escapeHtml(badge)}</strong>` : ""}
    </a>
  `;
}

function renderMonitoringBottomNav() {
  return `
    <nav class="bottom-nav monitor-bottom-nav" aria-label="Monitoring privilege navigation">
      ${bottomNavLink("/development/soc.html", "S", "SOC", "soc")}
      ${bottomNavLink("/development/system.html", "M", "System", "system")}
      ${bottomNavLink("/development/web-analytics.html", "W", "Web", "webAnalytics")}
      ${bottomNavLink("/development/speed-insights.html", "F", "Speed", "speedInsights")}
      ${bottomNavLink("/development/observability.html", "O", "Observe", "observability")}
      ${bottomNavLink("/development/analytics.html", "A", "Analytics", "analytics")}
    </nav>
  `;
}

function renderBottomNav() {
  if (monitoringPages.has(page)) {
    return renderMonitoringBottomNav();
  }

  return `
    <nav class="bottom-nav module-bottom-nav" aria-label="Module navigation">
      ${bottomNavLink("/user/index.html", "U", "User", "user")}
      ${bottomNavLink("/owner/index.html", "P", "Owner", "owner")}
      ${bottomNavLink("/admin/index.html", "A", "Admin", "admin")}
      ${bottomNavLink("/development/index.html", "D", "Dev", "monitoring")}
      ${bottomNavLink("/user/cart.html", "C", "Cart", "cart", cartCount() ? String(cartCount()) : "")}
    </nav>
  `;
}

function renderHeader() {
  return `
    <header class="top-header">
      <a class="brand-link" href="/index.html" aria-label="ScaleMart home">
        <span class="brand-mark">S</span>
        <span class="brand-text">ScaleMart</span>
      </a>
      <div class="search-wrap">
        <input data-filter="query" data-focus-key="search" type="search" value="${escapeHtml(state.filters.query)}" placeholder="Search for products, brands and more">
      </div>
      <nav class="main-nav" aria-label="Store navigation">
        ${navLink("/index.html", "Home", "home")}
        ${navLink("/user/index.html", "User", "user")}
        ${navLink("/owner/index.html", "Owner", "owner")}
        ${navLink("/admin/index.html", "Admin", "admin")}
        ${navLink("/development/index.html", "Dev", "monitoring")}
        ${navLink("/user/cart.html", `Cart (${cartCount()})`, "cart")}
        ${navLink("/user/orders.html", "Orders", "orders")}
        ${navLink("/admin/cache.html", "Cache", "cache")}
      </nav>
      ${isSignedIn() ? `<button class="user-button" type="button" data-action="sign-out" title="Sign out">${escapeHtml(currentUserEmail())}</button>` : `<a class="user-button" href="/login.html">Login</a>`}
    </header>
  `;
}

function renderCategoryStrip() {
  return `
    <div class="category-strip" aria-label="Product departments">
      ${categories().map((category) => `
        <button class="category-chip ${state.filters.category === category ? "active" : ""}" type="button" data-action="category" data-category="${escapeHtml(category)}">
          ${category === "all" ? "All" : escapeHtml(category)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderProductCard(product) {
  const inCart = state.cart.find((item) => item.productId === product.id);
  return `
    <article class="product-card">
      <a class="product-media" href="/user/cart.html" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
      </a>
      <div class="product-info">
        <span class="product-badge">${escapeHtml(product.badge)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="rating-row">
          <span class="rating">${escapeHtml(product.rating)} star</span>
          <span>${escapeHtml(product.stock)} left</span>
        </div>
        <div class="price-row">
          <strong>${formatMoney(product.pricePaise)}</strong>
          <span>${escapeHtml(product.delivery)}</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn add" type="button" data-action="add-to-cart" data-product-id="${escapeHtml(product.id)}" ${state.loading.action === product.id ? "disabled" : ""}>${inCart ? `Add more (${inCart.quantity})` : "Add to cart"}</button>
        <button class="btn buy" type="button" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">Buy now</button>
      </div>
    </article>
  `;
}

function renderFaqItems() {
  const faqs = [
    ["Can I browse without login?", "Yes. The home page and login page are public. Cart, orders, admin, owner and monitoring pages require a Supabase session."],
    ["Where is cart data stored?", "Cart and order data are stored per signed-in user through the backend and Upstash Redis cache."],
    ["Who can use the monitoring pages?", "The monitoring pages are session-protected and ready for role claims. Add Supabase role enforcement when you want strict privilege control."],
    ["Can shop owners manage products?", "The owner module shows catalog, inventory, stock health and product cache controls for shop owner workflows."]
  ];
  return faqs.map(([question, answer]) => `
    <details class="faq-item">
      <summary>${escapeHtml(question)}</summary>
      <p>${escapeHtml(answer)}</p>
    </details>
  `).join("");
}

function renderHomePage() {
  const products = visibleProducts().slice(0, 8);
  return `
    ${renderHeader()}
    ${renderCategoryStrip()}
    <main class="home-layout public-home">
      <section class="store-banner public-hero">
        <div>
          <p class="eyebrow">ScaleMart Commerce</p>
          <h1>Fast ecommerce with role-based dashboards.</h1>
          <p>Browse products publicly, then sign in to access cart, orders, shop owner tools, admin operations and development monitoring.</p>
          <div class="public-actions">
            <a class="btn primary" href="/login.html">Login to continue</a>
            <a class="btn ghost" href="#featured-products">View products</a>
          </div>
        </div>
      </section>

      <section class="seo-section" aria-labelledby="seoTitle">
        <div class="section-title">
          <div>
            <p class="eyebrow">Online shopping platform</p>
            <h2 id="seoTitle">Role-ready ecommerce for customers, owners, admins and developers</h2>
            <p>ScaleMart combines a customer storefront with Supabase login, user-scoped cart cache, order history, shop owner inventory, admin cache operations and development monitoring pages.</p>
          </div>
        </div>
        <div class="seo-grid">
          <article><strong>User module</strong><span>Browse products, manage cart, place orders and review order history.</span></article>
          <article><strong>Shop owner module</strong><span>Review catalog, stock levels, product cache and owner inventory views.</span></article>
          <article><strong>Admin module</strong><span>Operate orders, cache controls and platform status from protected pages.</span></article>
          <article><strong>Development module</strong><span>Monitor SOC, system health, analytics, speed insights and observability.</span></article>
        </div>
      </section>

      <section id="featured-products" class="store-toolbar">
        <div>
          <h2>Featured products</h2>
          <p>${escapeHtml(productCacheLabel())} - public catalog preview</p>
        </div>
        <div class="toolbar-controls">
          <select data-filter="sort" aria-label="Sort products">
            <option value="featured" ${state.filters.sort === "featured" ? "selected" : ""}>Featured</option>
            <option value="price-low" ${state.filters.sort === "price-low" ? "selected" : ""}>Price low to high</option>
            <option value="price-high" ${state.filters.sort === "price-high" ? "selected" : ""}>Price high to low</option>
            <option value="rating" ${state.filters.sort === "rating" ? "selected" : ""}>Top rated</option>
            <option value="stock" ${state.filters.sort === "stock" ? "selected" : ""}>Stock</option>
          </select>
          <button class="btn ghost" type="button" data-action="reload-products">Refresh</button>
        </div>
      </section>

      ${renderMessage()}

      <section class="product-grid" aria-label="Featured products">
        ${products.length ? products.map(renderProductCard).join("") : `<div class="empty-state">No products found.</div>`}
      </section>

      <section class="seo-section" aria-labelledby="faqTitle">
        <div class="section-title">
          <div>
            <p class="eyebrow">FAQ</p>
            <h2 id="faqTitle">Frequently asked questions</h2>
          </div>
        </div>
        <div class="faq-list">
          ${renderFaqItems()}
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <div>
        <strong>ScaleMart</strong>
        <p>Public ecommerce homepage with protected role dashboards.</p>
      </div>
      <nav aria-label="Footer links">
        <a href="/login.html">Login</a>
        <a href="/user/index.html">User</a>
        <a href="/owner/index.html">Owner</a>
        <a href="/admin/index.html">Admin</a>
        <a href="/development/index.html">Monitoring</a>
      </nav>
    </footer>
    ${isSignedIn() ? renderBottomNav() : ""}
  `;
}
function renderCartItem(item) {
  const product = productById(item.productId) || {};
  return `
    <article class="cart-item">
      <img src="${escapeHtml(product.image || fallbackImages[0])}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="cart-copy">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${formatMoney(item.pricePaise)} each</p>
        <div class="qty-control" aria-label="Quantity for ${escapeHtml(item.name)}">
          <button type="button" data-action="quantity" data-product-id="${escapeHtml(item.productId)}" data-direction="-1">-</button>
          <span>${escapeHtml(item.quantity)}</span>
          <button type="button" data-action="quantity" data-product-id="${escapeHtml(item.productId)}" data-direction="1">+</button>
        </div>
      </div>
      <strong>${formatMoney(item.lineTotalPaise)}</strong>
    </article>
  `;
}

function renderCartPage() {
  const total = cartTotalPaise();
  return `
    ${renderHeader()}
    <main class="page-layout two-column">
      <section class="page-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">Shopping cart</p>
            <h1>My cart</h1>
          </div>
          <a class="text-link" href="/index.html">Continue shopping</a>
        </div>
        ${renderMessage()}
        <div class="cart-list">
          ${state.cart.length ? state.cart.map(renderCartItem).join("") : `<div class="empty-state">Your cart is empty.</div>`}
        </div>
      </section>

      <aside class="summary-panel">
        <h2>Price details</h2>
        <div class="summary-row"><span>Items</span><strong>${cartCount()}</strong></div>
        <div class="summary-row"><span>Total</span><strong>${formatMoney(total)}</strong></div>
        <div class="summary-row"><span>Delivery</span><strong>Free</strong></div>
        <div class="summary-total"><span>Amount payable</span><strong>${formatMoney(total)}</strong></div>
        <button class="btn primary wide" type="button" data-action="submit-order" data-status="success" ${!state.cart.length ? "disabled" : ""}>Place order</button>
        <button class="btn warning wide" type="button" data-action="submit-order" data-status="failed" ${!state.cart.length ? "disabled" : ""}>Save failed order</button>
        <button class="btn danger wide" type="button" data-action="clear-cart" ${!state.cart.length ? "disabled" : ""}>Clear cart</button>
      </aside>
    </main>
    ${renderBottomNav()}
  `;
}

function renderOrder(order) {
  const items = (order.items || []).map((item) => item.name).join(", ");
  const canCancel = order.status === "success";
  return `
    <article class="order-card">
      <div>
        <strong>${escapeHtml(order.id)}</strong>
        <p>${escapeHtml(items || "No items")}</p>
        <span>${formatDate(order.createdAt)}</span>
      </div>
      <div>
        <span class="order-status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
        <strong>${formatMoney(order.totalPaise)}</strong>
      </div>
      <button class="btn danger" type="button" data-action="order-status" data-order-id="${escapeHtml(order.id)}" data-status="cancelled" ${!canCancel ? "disabled" : ""}>Cancel</button>
    </article>
  `;
}

function renderOrdersPage() {
  const orders = visibleOrders();
  return `
    ${renderHeader()}
    <main class="page-layout">
      <section class="page-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">Order history</p>
            <h1>My orders</h1>
          </div>
          <select data-filter="status" aria-label="Filter orders">
            <option value="all" ${state.filters.status === "all" ? "selected" : ""}>All orders</option>
            <option value="success" ${state.filters.status === "success" ? "selected" : ""}>Successful</option>
            <option value="failed" ${state.filters.status === "failed" ? "selected" : ""}>Failed</option>
            <option value="cancelled" ${state.filters.status === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>
        <div class="metric-row">
          <div><span>Total orders</span><strong>${state.orders.length}</strong></div>
          <div><span>Visible</span><strong>${orders.length}</strong></div>
          <div><span>Order value</span><strong>${formatMoney(orderTotalPaise())}</strong></div>
        </div>
        ${renderMessage()}
        <div class="orders-list">
          ${orders.length ? orders.map(renderOrder).join("") : `<div class="empty-state">No orders found.</div>`}
        </div>
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderCachePage() {
  const keys = state.cache?.keys || [];
  return `
    ${renderHeader()}
    <main class="page-layout two-column">
      <section class="page-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">Operations</p>
            <h1>Cache manager</h1>
          </div>
          <span class="status-pill ${cacheConfigured() ? "online" : "warning"}">${cacheConfigured() ? "Online" : "Check config"}</span>
        </div>
        ${renderMessage()}
        <div class="metric-row">
          <div><span>Products</span><strong>${state.products.length}</strong></div>
          <div><span>Cart items</span><strong>${cartCount()}</strong></div>
          <div><span>Orders</span><strong>${state.orders.length}</strong></div>
        </div>
        <div class="cache-grid">
          ${keys.length ? keys.map((entry) => `
            <article class="cache-key">
              <strong>${escapeHtml(entry.key)}</strong>
              <span>${escapeHtml(ttlLabel(entry.ttlSeconds))}</span>
            </article>
          `).join("") : `<div class="empty-state">No cache keys loaded.</div>`}
        </div>
      </section>
      <aside class="summary-panel">
        <h2>Cache actions</h2>
        <button class="btn primary wide" type="button" data-action="cache" data-cache-action="warm-all">Warm my cache</button>
        <button class="btn ghost wide" type="button" data-action="cache" data-cache-action="refresh-products">Refresh products</button>
        <button class="btn warning wide" type="button" data-action="cache" data-cache-action="clear-products">Clear products</button>
        <button class="btn danger wide" type="button" data-action="cache" data-cache-action="clear-my-cache">Clear my cache</button>
      </aside>
    </main>
    ${renderBottomNav()}
  `;
}

function statusCount(status) {
  return state.orders.filter((order) => order.status === status).length;
}

function lowStockProducts() {
  return state.products.filter((product) => Number(product.stock || 0) <= 45);
}

function renderModuleMetric(label, value, note = "") {
  return `
    <div class="module-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ""}
    </div>
  `;
}

function renderModuleCard(title, body, action = "") {
  return `
    <article class="module-card">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${body}</p>
      </div>
      ${action}
    </article>
  `;
}

function renderModuleShell(kind, title, description, metrics, content) {
  return `
    ${renderHeader()}
    <main class="module-layout">
      <section class="module-hero ${kind}">
        <div>
          <p class="eyebrow">${escapeHtml(kind.replace("-", " "))} module</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
      </section>
      ${renderMessage()}
      <section class="module-metrics" aria-label="Module metrics">
        ${metrics}
      </section>
      ${content}
    </main>
    ${renderBottomNav()}
  `;
}

function renderUserModulePage() {
  const latestOrder = state.orders[0];
  const metrics = [
    renderModuleMetric("Signed in as", currentUserEmail() || "Unknown", "Supabase session"),
    renderModuleMetric("Cart", `${cartCount()} items`, formatMoney(cartTotalPaise())),
    renderModuleMetric("Orders", String(state.orders.length), `${statusCount("success")} successful`),
    renderModuleMetric("Cache", cacheConfigured() ? "Online" : "Check", state.cache?.message || "Waiting")
  ].join("");
  const content = `
    <section class="module-grid two">
      ${renderModuleCard("Shopping profile", "Manage the customer journey from browsing products to cart and order history.", `<a class="btn primary" href="/index.html">Shop products</a>`)}
      ${renderModuleCard("Current cart", `${cartCount()} items are saved in this user's Upstash cart cache.`, `<a class="btn ghost" href="/user/cart.html">Open cart</a>`)}
      ${renderModuleCard("Latest order", latestOrder ? `${escapeHtml(latestOrder.id)} is currently ${escapeHtml(latestOrder.status)}.` : "No orders created yet.", `<a class="btn ghost" href="/user/orders.html">View orders</a>`)}
      ${renderModuleCard("User cache", `Cart and order keys are scoped to this Supabase user id.`, `<a class="btn ghost" href="/admin/cache.html">View cache</a>`)}
    </section>
  `;
  return renderModuleShell("user", "User module", "Customer home for account, cart, checkout and order history.", metrics, content);
}

function renderOwnerModulePage() {
  const lowStock = lowStockProducts();
  const categoriesList = categories().filter((category) => category !== "all");
  const metrics = [
    renderModuleMetric("Products", String(state.products.length), `${categoriesList.length} departments`),
    renderModuleMetric("Low stock", String(lowStock.length), "Stock at or below 45"),
    renderModuleMetric("Product cache", productCacheLabel(), state.productCache?.key || "catalog"),
    renderModuleMetric("Order demand", String(state.orders.length), formatMoney(orderTotalPaise()))
  ].join("");
  const productRows = state.products.map((product) => `
    <article class="inventory-row">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category)} - ${escapeHtml(product.sku)}</span>
      </div>
      <span>${formatMoney(product.pricePaise)}</span>
      <span>${escapeHtml(product.stock)} stock</span>
      <span class="status-pill ${Number(product.stock) <= 45 ? "warning" : "online"}">${Number(product.stock) <= 45 ? "Restock" : "Active"}</span>
    </article>
  `).join("");
  const content = `
    <section class="module-panel">
      <div class="section-title">
        <div><p class="eyebrow">Catalog control</p><h2>Shop owner inventory</h2></div>
        <button class="btn ghost" type="button" data-action="cache" data-cache-action="refresh-products">Refresh product cache</button>
      </div>
      <div class="inventory-list">${productRows || `<div class="empty-state">No products loaded.</div>`}</div>
    </section>
  `;
  return renderModuleShell("owner", "Product owner module", "Shop owner view for product inventory, catalog health and demand signals.", metrics, content);
}

function renderAdminModulePage() {
  const metrics = [
    renderModuleMetric("Users", "Session based", currentUserEmail() || "No user"),
    renderModuleMetric("Orders", String(state.orders.length), `${statusCount("failed")} failed, ${statusCount("cancelled")} cancelled`),
    renderModuleMetric("Cache state", cacheConfigured() ? "Online" : "Offline", state.cache?.prefix || "cache-commerce"),
    renderModuleMetric("Revenue sample", formatMoney(orderTotalPaise()), "Current user scope")
  ].join("");
  const content = `
    <section class="module-grid two">
      ${renderModuleCard("Order operations", `Successful: ${statusCount("success")}, failed: ${statusCount("failed")}, cancelled: ${statusCount("cancelled")}.`, `<a class="btn ghost" href="/user/orders.html">Open orders</a>`)}
      ${renderModuleCard("Cache operations", "Warm, clear, and inspect user cache keys from the operations page.", `<a class="btn ghost" href="/admin/cache.html">Open cache</a>`)}
      ${renderModuleCard("Product operations", "Catalog is code-backed and cached through Upstash for storefront speed.", `<a class="btn ghost" href="/owner/index.html">Open owner</a>`)}
      ${renderModuleCard("Access note", "These module pages are session protected. Add Supabase role claims later for strict permission enforcement.", `<a class="btn primary" href="/development/index.html">Monitor system</a>`)}
    </section>
  `;
  return renderModuleShell("admin", "Admin module", "Administrative command center for orders, cache, catalog and access status.", metrics, content);
}

function renderMonitoringPrivilegePage() {
  const health = state.health || {};
  const keys = state.cache?.keys || [];
  const monitoringConfigs = {
    soc: {
      title: "SOC monitoring",
      description: "Security operations view for account activity, failed flows and incident readiness.",
      signal: "Security posture",
      value: statusCount("failed") ? "Review" : "Stable",
      note: `${statusCount("failed")} failed orders observed`,
      cards: [
        ["Authentication watch", `Signed-in session belongs to ${escapeHtml(currentUserEmail() || "unknown user")}.`],
        ["Incident queue", `${statusCount("failed")} failed orders and ${statusCount("cancelled")} cancelled orders are visible in this scope.`],
        ["Cache access", `${keys.length} monitored keys are available for this user context.`],
        ["Response action", "Use the admin module to inspect order state and the cache module to clear suspicious user cache data."]
      ]
    },
    system: {
      title: "System monitoring",
      description: "Runtime health for backend, Supabase, Upstash and product cache dependencies.",
      signal: "Backend",
      value: health.ok ? "Healthy" : "Check",
      note: apiBaseUrl,
      cards: [
        ["Backend API", health.error ? escapeHtml(health.error) : `Health endpoint ok=${escapeHtml(Boolean(health.ok))}.`],
        ["Upstash Redis", health.upstashConfigured ? "Environment is configured and cache page can inspect keys." : "Upstash env vars are missing."],
        ["Supabase Auth", health.supabaseConfigured ? "Backend Supabase verification is configured." : "Backend Supabase env vars are missing."],
        ["Product cache", `${productCacheLabel()} for ${escapeHtml(state.productCache?.key || "catalog")}.`]
      ]
    },
    webAnalytics: {
      title: "Web analytics",
      description: "Storefront funnel view for catalog, cart and order activity in the current signed-in scope.",
      signal: "Catalog",
      value: `${state.products.length} SKUs`,
      note: `${cartCount()} cart items`,
      cards: [
        ["Catalog coverage", `${state.products.length} products across ${categories().filter((category) => category !== "all").length} departments.`],
        ["Cart intent", `${cartCount()} items currently saved with value ${formatMoney(cartTotalPaise())}.`],
        ["Order activity", `${state.orders.length} orders with ${statusCount("success")} successful outcomes.`],
        ["Conversion sample", state.orders.length ? `${Math.round((statusCount("success") / state.orders.length) * 100)}% successful order share.` : "No orders yet for conversion sampling."]
      ]
    },
    speedInsights: {
      title: "Speed insights",
      description: "Performance signals for cache hit status, dependency readiness and storefront weight.",
      signal: "Cache speed",
      value: productCacheLabel(),
      note: state.productCache?.ttlSeconds ? `${state.productCache.ttlSeconds}s product TTL` : "TTL pending",
      cards: [
        ["Product delivery", `${productCacheLabel()} from ${escapeHtml(state.productCache?.source || "origin")}.`],
        ["Runtime checks", health.ok ? "Backend health check is passing." : "Backend health check needs attention."],
        ["Frontend build", "Vite emits static HTML pages with one shared JS/CSS asset set."],
        ["Optimization queue", "Keep catalog cached, reduce image weight, and watch checkout API latency in production."]
      ]
    },
    observability: {
      title: "Observability",
      description: "Operational visibility into cache keys, API state, product data and customer activity.",
      signal: "Signals",
      value: `${keys.length} keys`,
      note: cacheConfigured() ? "Cache reachable" : "Cache not confirmed",
      cards: [
        ["Cache keys", keys.length ? keys.map((entry) => escapeHtml(entry.key)).join(", ") : "No keys loaded yet."],
        ["Order events", `${state.orders.length} cached order records in this user scope.`],
        ["Catalog state", `${state.products.length} products loaded from ${escapeHtml(state.productCache?.source || "origin")}.`],
        ["Trace target", "Use request ids from Vercel logs together with backend health and cache snapshots."]
      ]
    },
    analytics: {
      title: "Analytics",
      description: "Business analytics for products, orders, cart value and operational outcomes.",
      signal: "Order value",
      value: formatMoney(orderTotalPaise()),
      note: `${state.orders.length} orders tracked`,
      cards: [
        ["Revenue sample", `${formatMoney(orderTotalPaise())} in current user-scoped order value.`],
        ["Best stocked", state.products.length ? `${escapeHtml([...state.products].sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))[0].name)} has highest stock.` : "Products not loaded."],
        ["Failure rate", state.orders.length ? `${Math.round((statusCount("failed") / state.orders.length) * 100)}% failed order share.` : "No failed-order sample yet."],
        ["Next report", "Connect event analytics or warehouse tables when you add production tracking."]
      ]
    }
  };
  const config = monitoringConfigs[page] || monitoringConfigs.system;
  const metrics = [
    renderModuleMetric("Privilege", "Monitoring", "Session protected"),
    renderModuleMetric(config.signal, config.value, config.note),
    renderModuleMetric("Backend", health.ok ? "Healthy" : "Check", apiBaseUrl),
    renderModuleMetric("Cache", cacheConfigured() ? "Online" : "Check", `${keys.length} keys`)
  ].join("");
  const content = `
    <section class="module-grid two monitoring-grid">
      ${config.cards.map(([title, body]) => renderModuleCard(title, body)).join("")}
    </section>
    <section class="module-panel">
      <div class="section-title">
        <div><p class="eyebrow">Monitoring action</p><h2>Refresh live checks</h2></div>
        <button class="btn ghost" type="button" data-action="reload-monitoring">Recheck</button>
      </div>
    </section>
  `;
  return renderModuleShell("monitoring", config.title, config.description, metrics, content);
}
function renderMonitoringModulePage() {
  const health = state.health || {};
  const keys = state.cache?.keys || [];
  const metrics = [
    renderModuleMetric("Backend", health.ok ? "Healthy" : "Check", apiBaseUrl),
    renderModuleMetric("Upstash", health.upstashConfigured ? "Configured" : "Missing", cacheConfigured() ? "Reachable" : "Not confirmed"),
    renderModuleMetric("Supabase", health.supabaseConfigured ? "Configured" : "Missing", hasSupabaseConfig ? "Frontend configured" : "Frontend missing"),
    renderModuleMetric("Cache keys", String(keys.length), productCacheLabel())
  ].join("");
  const keyRows = keys.map((entry) => `
    <article class="monitor-row">
      <strong>${escapeHtml(entry.key)}</strong>
      <span>${escapeHtml(ttlLabel(entry.ttlSeconds))}</span>
    </article>
  `).join("");
  const content = `
    <section class="module-grid two">
      ${renderModuleCard("API health", health.error ? escapeHtml(health.error) : `Backend reports ok=${escapeHtml(Boolean(health.ok))}.`, `<button class="btn ghost" type="button" data-action="reload-monitoring">Recheck</button>`)}
      ${renderModuleCard("Deployment", `Frontend calls ${escapeHtml(apiBaseUrl)}. Verify Vercel env vars when a module is blank.`, `<a class="btn ghost" href="/admin/cache.html">Cache page</a>`)}
    </section>
    <section class="module-panel">
      <div class="section-title"><div><p class="eyebrow">Runtime cache</p><h2>Observed keys</h2></div></div>
      <div class="monitor-list">${keyRows || `<div class="empty-state">No cache keys loaded.</div>`}</div>
    </section>
  `;
  return renderModuleShell("monitoring", "Development team monitoring", "System view for backend health, environment configuration and Upstash cache visibility.", metrics, content);
}
function renderLoginPage() {
  return `
    <main class="login-page">
      <section class="login-hero">
        <a class="brand-link login-brand" href="/index.html">
          <span class="brand-mark">S</span>
          <span class="brand-text">ScaleMart</span>
        </a>
        <div>
          <p class="eyebrow">Online shopping</p>
          <h1>Sign in to shop faster</h1>
          <p>Your cart, orders and cached data stay connected to your account.</p>
        </div>
      </section>

      <section class="login-card" aria-labelledby="loginTitle">
        <p class="eyebrow">Account</p>
        <h2 id="loginTitle">${state.authMode === "signin" ? "Login" : "Create account"}</h2>
        ${renderMessage()}
        <div class="auth-tabs">
          <button class="${state.authMode === "signin" ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signin">Login</button>
          <button class="${state.authMode === "signup" ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signup">Signup</button>
        </div>
        <form class="auth-form" data-form="auth">
          <label>Email<input data-field="auth-email" data-focus-key="auth-email" type="email" autocomplete="email" value="${escapeHtml(state.email)}" required></label>
          <label>Password<input data-field="auth-password" data-focus-key="auth-password" type="password" autocomplete="${state.authMode === "signin" ? "current-password" : "new-password"}" value="${escapeHtml(state.password)}" minlength="6" required></label>
          <button class="btn primary wide" type="submit" ${state.loading.auth ? "disabled" : ""}>${state.loading.auth ? "Please wait" : state.authMode === "signin" ? "Login" : "Create account"}</button>
        </form>
      </section>
    </main>
  `;
}

function renderProtectedPrompt() {
  return `
    <main class="login-page">
      <section class="login-card solo">
        <p class="eyebrow">Session</p>
        <h1>Login required</h1>
        <a class="btn primary wide" href="/login.html?next=${encodeURIComponent(window.location.pathname)}">Go to login</a>
      </section>
    </main>
  `;
}

function focusSnapshot() {
  const active = document.activeElement;
  if (!active || !app.contains(active) || !active.dataset.focusKey) {
    return null;
  }
  return {
    key: active.dataset.focusKey,
    start: typeof active.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active.selectionEnd === "number" ? active.selectionEnd : null
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) {
    return;
  }
  const next = app.querySelector(`[data-focus-key="${snapshot.key}"]`);
  if (!next) {
    return;
  }
  next.focus();
  if (typeof next.setSelectionRange === "function" && snapshot.start !== null) {
    try {
      next.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      // Some inputs do not expose selection ranges.
    }
  }
}

function render() {
  const snapshot = focusSnapshot();
  if (!state.authReady) {
    app.innerHTML = renderBoot();
  } else if (page === "login") {
    app.innerHTML = renderLoginPage();
  } else if (protectedPages.has(page) && !isSignedIn()) {
    app.innerHTML = renderProtectedPrompt();
  } else if (page === "cart") {
    app.innerHTML = renderCartPage();
  } else if (page === "orders") {
    app.innerHTML = renderOrdersPage();
  } else if (page === "cache") {
    app.innerHTML = renderCachePage();
  } else if (page === "user") {
    app.innerHTML = renderUserModulePage();
  } else if (page === "owner") {
    app.innerHTML = renderOwnerModulePage();
  } else if (page === "admin") {
    app.innerHTML = renderAdminModulePage();
  } else if (page === "monitoring") {
    app.innerHTML = renderMonitoringModulePage();
  } else if (monitoringPages.has(page)) {
    app.innerHTML = renderMonitoringPrivilegePage();
  } else {
    app.innerHTML = renderHomePage();
  }
  restoreFocus(snapshot);
}

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) {
    return;
  }
  event.preventDefault();
  if (form.dataset.form === "auth") {
    await submitAuth();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.field === "auth-email") {
    state.email = target.value;
  }
  if (target.dataset.field === "auth-password") {
    state.password = target.value;
  }
  if (target.dataset.filter === "query") {
    state.filters.query = target.value;
    render();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.filter && target.dataset.filter !== "query") {
    state.filters[target.dataset.filter] = target.value;
    render();
  }
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) {
    return;
  }

  const { action } = button.dataset;
  if (action === "auth-mode") {
    state.authMode = button.dataset.mode || "signin";
    clearMessage();
    render();
  }
  if (action === "sign-out") {
    await signOut();
  }
  if (action === "category") {
    state.filters.category = button.dataset.category || "all";
    render();
  }
  if (action === "reload-products") {
    await loadProducts();
    await loadCache();
  }
  if (action === "add-to-cart") {
    await addToCart(button.dataset.productId);
  }
  if (action === "buy-now") {
    event.preventDefault();
    await addToCart(button.dataset.productId, true);
  }
  if (action === "quantity") {
    await updateQuantity(button.dataset.productId, Number(button.dataset.direction));
  }
  if (action === "clear-cart") {
    await clearCart();
  }
  if (action === "submit-order") {
    await submitOrder(button.dataset.status);
  }
  if (action === "order-status") {
    await updateOrderStatus(button.dataset.orderId, button.dataset.status);
  }
  if (action === "cache") {
    await runCacheAction(button.dataset.cacheAction);
  }
  if (action === "reload-monitoring") {
    await Promise.all([loadHealth(), loadCache()]);
  }
});

async function bootstrap() {
  render();

  if (!hasSupabaseConfig || !supabase) {
    state.authReady = true;
    if (page === "home") {
      await loadProducts();
    } else {
      state.message = "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.";
      state.messageType = "error";
      render();
    }
    return;
  }

  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.authReady = true;

  if (page === "login" && state.session) {
    const nextUrl = new URLSearchParams(window.location.search).get("next") || "/user/index.html";
    window.location.href = nextUrl;
    return;
  }

  if (protectedPages.has(page) && !state.session) {
    window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  render();
  await loadPageData();

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    state.session = nextSession;
    if (!nextSession && protectedPages.has(page)) {
      window.location.href = "/login.html";
      return;
    }
    if (nextSession && page !== "login") {
      await loadPageData();
      return;
    }
    render();
  });
}

bootstrap();
