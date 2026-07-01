import { hasSupabaseConfig, supabase } from "./lib/supabase.js";
import "./app.css";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const app = document.querySelector("#app");
const page = document.body.dataset.page || "home";
const protectedPages = new Set(["cart", "orders", "cache", "user"]);
const publicPages = new Set(["home", "categories", "account", "publicCart"]);
const monitoringPages = new Set();
const retiredModulePathPattern = /^\/(owner|admin|development)\//;

const state = {
  authReady: false,
  authMode: "signin",
  loginView: "phone",
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

const storefrontCategories = [
  ["For You", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=160&q=80"],
  ["Fashion", "https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=160&q=80"],
  ["Mobiles", "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=160&q=80"],
  ["Beauty", "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80"],
  ["Electronics", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=160&q=80"],
  ["Home", "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=160&q=80"],
  ["Appliances", "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=160&q=80"],
  ["Toys, Baby..", "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=160&q=80"],
  ["Food & Health", "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=160&q=80"],
  ["Auto Accessories", "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=160&q=80"],
  ["2 Wheelers", "https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?auto=format&fit=crop&w=160&q=80"],
  ["Sports & Fitness", "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=160&q=80"],
  ["Books & Media", "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=160&q=80"],
  ["Furniture", "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=160&q=80"]
];

const promoTiles = [
  { title: "GOAT Sale is live", subtitle: "Biggest offers on mobiles, fashion and appliances", badge: "AD", cta: "Shop Now", image: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1400&q=80", tone: "sale" },
  { title: "OPPO Reno 16 Series 5G", subtitle: "Launching 2nd Jul | 50 MP telephoto camera", badge: "AD", cta: "Notify Me", image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1400&q=80", tone: "phone" },
  { title: "Flights, hotels and more", subtitle: "Travel deals with instant discounts", badge: "NEW", cta: "Explore", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80", tone: "travel" }
];

const trendItems = [
  ["Best of smartphones", "Mega exchange offers", "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=650&q=80"],
  ["Grooming essentials", "Min. 50% Off", "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=650&q=80"],
  ["Premium furniture", "From Rs. 1,999", "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=650&q=80"],
  ["Kitchen favourites", "Top deals", "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=650&q=80"]
];

const mobileDealItems = [
  ["Time to upgrade", "Up to 50% Off", "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=420&q=80"],
  ["Strong fragrance", "Up to 65% Off", "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=420&q=80"],
  ["Men's sneakers", "Min. 50% Off", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=420&q=80"]
];

const spotlightItems = [
  ["Action cameras", "From Rs. 2,999", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=520&q=80"],
  ["Linen co-ords", "Min. 40% Off", "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=520&q=80"]
];

const categorySidebarItems = [
  ["For You", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=80"],
  ["Fashion", "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=160&q=80"],
  ["Mobiles", "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=160&q=80"],
  ["Appliances", "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=160&q=80"],
  ["Electronics", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=160&q=80"],
  ["Smart Gadgets", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=160&q=80"],
  ["Home", "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=160&q=80"],
  ["Beauty & Personal Care", "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80"],
  ["Toys & Baby Care", "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=160&q=80"],
  ["Food & Healthcare", "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=160&q=80"],
  ["Sports & Fitness", "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=160&q=80"],
  ["Auto Accessories", "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=160&q=80"],
  ["Pet Store", "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=160&q=80"],
  ["Furniture", "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=160&q=80"],
  ["Bikes & Scooters", "https://images.unsplash.com/photo-1558981852-426c6c22a060?auto=format&fit=crop&w=160&q=80"],
  ["Travel", "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=160&q=80"],
  ["Books & Media", "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=160&q=80"],
  ["Gift Cards", "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=160&q=80"],
  ["Sell/Exchange Old Devices", "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=160&q=80"]
];

const categoryStoreCards = [
  ["GOAT SALE", "Starts 4th July", "sale"],
  ["EARLY BIRD DEALS", "Live now", "early"]
];

const categoryLaunchItems = [
  ["Kaynano 32", "SHOP NOW", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=320&q=80"],
  ["Nova 2 Pro 5G", "BUY NOW", "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=320&q=80"],
  ["Nova 2 Neo 5G", "BUY NOW", "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=320&q=80"],
  ["Phone (4b)", "NOTIFY ME", "https://images.unsplash.com/photo-1616410011236-7a42121dd981?auto=format&fit=crop&w=320&q=80"],
  ["ONMC+ Smart console", "BUY NOW", "https://images.unsplash.com/photo-1603481546238-487240415921?auto=format&fit=crop&w=320&q=80"],
  ["Moto Pad 70 Pro", "NOTIFY ME", "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=320&q=80"],
  ["OnePlus Nord Buds 4", "BUY NOW", "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=320&q=80"],
  ["VIZ TV", "BUY NOW", "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=320&q=80"]
];

const categoryTryItems = [
  ["Claim Now", "student"],
  ["SuperCoin", "coin"],
  ["Join BLACK", "black"],
  ["Bills & Recharges", "bills"],
  ["Flipkart Pay", "pay"],
  ["Personal Loan", "loan"],
  ["GenZ trends", "genz"],
  ["Become a Seller", "seller"],
  ["Brand Vouchers", "voucher"]
];

const categoryMoreItems = [
  ["Uber", "uber"],
  ["Pet Supplies", "pet"],
  ["Flipkart Green", "green"],
  ["Flipkart Samarth", "samarth"],
  ["Flipkart Originals", "originals"],
  ["SuperCoin Rewards", "rewards"],
  ["Next Gen Brands", "nextgen"]
];

const accountSettingsRows = [
  ["language", "Select Language", ""],
  ["bell", "Notification Settings", ""],
  ["help", "Help Center", ""]
];

const accountInfoRows = [
  ["document", "Terms, Policies and Licenses", ""],
  ["question", "Browse FAQs", ""]
];

const cartSuggestionProduct = {
  title: "Samsung Galaxy S26 5...",
  price: "Rs7999",
  image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=360&q=80"
};

const marketplaceRails = [
  {
    title: "Trending Gadgets & Appliances",
    sideAd: { title: "Top Deals", subtitle: "Best of electronics", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&q=80" },
    items: [
      ["True Wireless", "Min. 50% Off", "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=460&q=80"],
      ["Smart Watches", "Min. 40% Off", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=460&q=80"],
      ["Trimmers", "Min. 50% Off", "https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=460&q=80"],
      ["Neckband", "Popular", "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=460&q=80"],
      ["Projectors", "From Rs. 6,999", "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=460&q=80"],
      ["Power Banks", "From Rs. 799", "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=460&q=80"]
    ]
  },
  {
    title: "Add to your wishlist",
    items: [
      ["Striped Tee, Anime shirts...", "Under Rs. 349", "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=460&q=80"],
      ["Shop more!", "From Rs. 159", "https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=460&q=80"],
      ["Milton, Cello & more", "From Rs. 129", "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=460&q=80"],
      ["Men's Shoes, Sandals...", "Min. 40% Off", "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=460&q=80"],
      ["Travel backpacks", "Min. 55% Off", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=460&q=80"],
      ["Analog watches", "Top offers", "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=460&q=80"]
    ]
  },
  {
    title: "Fashion's Top Deals",
    items: [
      ["Men's Slippers & Flip Flops", "Min. 70% Off", "https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&w=460&q=80"],
      ["Men's Casual Shoes", "Min. 70% Off", "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=460&q=80"],
      ["Men's Sandals & Floaters", "Min. 70% Off", "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?auto=format&fit=crop&w=460&q=80"],
      ["Men's Sports Shoes", "Min. 70% Off", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=460&q=80"],
      ["Women's Footwear", "Min. 50% Off", "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=460&q=80"],
      ["Ethnic Wear", "Special offer", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=460&q=80"]
    ]
  },
  {
    title: "Home Decor & Furnishing",
    items: [
      ["Torches", "Top Sellers", "https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?auto=format&fit=crop&w=460&q=80"],
      ["Wall Clocks", "Top Picks", "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=460&q=80"],
      ["Bulbs", "New Collection", "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=460&q=80"],
      ["Bath Towels", "Widest Range", "https://images.unsplash.com/photo-1600369672770-985fd30004eb?auto=format&fit=crop&w=460&q=80"],
      ["Curtains", "Min. 45% Off", "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=460&q=80"],
      ["Cookware Sets", "From Rs. 499", "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=460&q=80"]
    ]
  }
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

  if (page === "categories") {
    if (isSignedIn()) {
      await Promise.all([loadProducts(), loadCart(), loadCache()]);
      return;
    }
    await loadProducts();
    return;
  }

  if (page === "account" || page === "publicCart") {
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
        <div class="brand-mark">f</div>
        <div>
          <h1>Flipkart</h1>
          <p>Loading store.</p>
        </div>
      </section>
    </main>
  `;
}

function navLink(href, label, key) {
  return `<a class="nav-link ${page === key ? "active" : ""}" href="${href}">${label}</a>`;
}

function bottomNavIcon(icon) {
  const icons = {
    home: `<svg class="bottom-nav-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.3 12 4l9 7.3v8.2a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H8.7V21H4.5A1.5 1.5 0 0 1 3 19.5z"/></svg>`,
    categories: `<svg class="bottom-nav-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>`,
    account: `<svg class="bottom-nav-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm-7 8.1c.7-3.9 3.3-6 7-6s6.3 2.1 7 6"/></svg>`,
    cart: `<svg class="bottom-nav-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 5h2l1.6 10.3h10.7L20 8H7.1"/><circle cx="9" cy="20" r="1.4"/><circle cx="17.4" cy="20" r="1.4"/></svg>`
  };
  return icons[icon] || escapeHtml(icon);
}

function bottomNavLink(href, icon, label, keys, badge = "") {
  const isActive = Array.isArray(keys) ? keys.includes(page) : page === keys;
  return `
    <a class="bottom-nav-link ${isActive ? "active" : ""}" href="${href}" aria-label="${escapeHtml(label)}">
      <span class="bottom-nav-icon">${bottomNavIcon(icon)}</span>
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
  return `
    <nav class="bottom-nav module-bottom-nav" aria-label="Customer navigation">
      ${bottomNavLink("/index.html", "home", "Home", "home")}
      ${bottomNavLink("/categories.html", "categories", "Categories", "categories")}
      ${bottomNavLink("/account.html", "account", "Account", ["account", "user", "orders", "cache"])}
      ${bottomNavLink("/cart.html", "cart", "Cart", ["publicCart", "cart"], cartCount() ? String(cartCount()) : "")}
    </nav>
  `;
}

function renderHeader() {
  return `
    <header class="top-header customer-header">
      <div class="brand-tabs" aria-label="Flipkart services">
        <a class="brand-tab primary" href="/index.html" aria-label="Flipkart home">
          <span class="flip-mark">f</span>
          <span class="brand-stack"><span>Flipkart</span><small>Explore Plus</small></span>
        </a>
        <a class="brand-tab travel" href="/index.html#featured-products">
          <span class="travel-mark">Air</span>
          <span>Travel</span>
        </a>
      </div>
      <div class="delivery-location">
        <span class="pin-dot" aria-hidden="true"></span>
        <span>Location not set</span>
        <a href="/login.html">Select delivery location</a>
      </div>
      <div class="search-wrap market-search">
        <span class="search-icon" aria-hidden="true"></span>
        <input data-filter="query" data-focus-key="search" type="search" value="${escapeHtml(state.filters.query)}" placeholder="Search for Products, Brands and More">
      </div>
      <nav class="header-actions" aria-label="Customer actions">
        ${isSignedIn() ? `<span class="signed-user" title="${escapeHtml(currentUserEmail())}">${escapeHtml(currentUserEmail())}</span><button class="logout-button" type="button" data-action="sign-out">Logout</button>` : `<a class="header-action login-action" href="/login.html"><span class="person-icon" aria-hidden="true"></span><span>Login</span><span class="chevron">v</span></a>`}
        <a class="header-action seller-action" href="#seller"><span class="seller-icon" aria-hidden="true"></span><span>Become a Seller</span></a>
        <button class="header-action more-action" type="button"><span>More</span><span class="chevron">v</span></button>
        <a class="header-action cart-action" href="/cart.html"><span class="cart-icon" aria-hidden="true"></span><span>Cart</span>${cartCount() ? `<strong>${cartCount()}</strong>` : ""}</a>
      </nav>
    </header>
  `;
}

function renderCategoryStrip() {
  return `
    <nav class="category-strip market-categories" aria-label="Product departments">
      ${storefrontCategories.map(([label, image], index) => `
        <a class="market-category ${index === 0 ? "active" : ""}" href="#featured-products">
          <span class="market-category-icon"><img src="${escapeHtml(image)}" alt="" loading="lazy"></span>
          <span>${escapeHtml(label)}</span>
        </a>
      `).join("")}
    </nav>
  `;
}

function renderProductCard(product) {
  const inCart = state.cart.find((item) => item.productId === product.id);
  return `
    <article class="product-card">
      <a class="product-media" href="/cart.html" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">
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

function renderMobileDealCard([title, offer, image]) {
  return `
    <article class="mobile-deal-card">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
      <strong>${escapeHtml(offer)}</strong>
      <span>${escapeHtml(title)}</span>
    </article>
  `;
}

function renderSpotlightCard([title, offer, image]) {
  return `
    <article class="spotlight-card">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(offer)}</strong>
    </article>
  `;
}

function renderRailItem([title, offer, image]) {
  return `
    <a class="rail-item" href="#featured-products" aria-label="${escapeHtml(title)} ${escapeHtml(offer)}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(offer)}</span>
    </a>
  `;
}

function renderMarketplaceRail(rail, index) {
  return `
    <section class="market-rail ${rail.sideAd ? "with-ad" : ""}" aria-labelledby="railTitle${index}">
      <div class="rail-heading">
        <h2 id="railTitle${index}">${escapeHtml(rail.title)}</h2>
        <a class="rail-more" href="#featured-products" aria-label="View all ${escapeHtml(rail.title)}">›</a>
      </div>
      <div class="rail-body">
        <div class="rail-strip">
          ${rail.items.map(renderRailItem).join("")}
        </div>
        ${rail.sideAd ? `
          <aside class="rail-ad">
            <img src="${escapeHtml(rail.sideAd.image)}" alt="${escapeHtml(rail.sideAd.title)}" loading="lazy">
            <strong>${escapeHtml(rail.sideAd.title)}</strong>
            <span>${escapeHtml(rail.sideAd.subtitle)}</span>
          </aside>
        ` : ""}
      </div>
    </section>
  `;
}

function renderMarketProductCard(product) {
  const inCart = state.cart.find((item) => item.productId === product.id);
  return `
    <article class="market-product-card">
      <a class="market-product-media" href="/cart.html" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
      </a>
      <div class="market-product-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category)} | ${escapeHtml(product.rating)} star</span>
        <b>${formatMoney(product.pricePaise)}</b>
      </div>
      <div class="market-product-actions">
        <button class="btn add" type="button" data-action="add-to-cart" data-product-id="${escapeHtml(product.id)}" ${state.loading.action === product.id ? "disabled" : ""}>${inCart ? `Add more (${inCart.quantity})` : "Add to cart"}</button>
        <button class="btn buy" type="button" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">Buy now</button>
      </div>
    </article>
  `;
}
function renderFaqItems() {
  const faqs = [
    ["Flipkart: India's Ultimate One-Stop Online Shopping Destination", "Browse mobiles, fashion, appliances, beauty, grocery, furniture and daily essentials from one responsive storefront."],
    ["What Can You Buy from Flipkart?", "Shop latest gadgets, apparel, footwear, home decor, cookware, personal care, toys, books and more across curated category rails."],
    ["How does this clone behave?", "The page mirrors the public storefront layout for desktop and mobile views while keeping the existing cart and account links wired to this demo app."],
    ["Are these real Flipkart assets?", "This local front end recreates the layout and visual rhythm with replacement imagery and demo content instead of copying private production assets."]
  ];
  return faqs.map(([question, answer]) => `
    <details class="faq-item">
      <summary>${escapeHtml(question)}</summary>
      <p>${escapeHtml(answer)}</p>
    </details>
  `).join("");
}

function renderCategoryTopBar() {
  return `
    <header class="categories-topbar">
      <a class="categories-icon-button" href="/index.html" aria-label="Back to home">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/><path d="M9 12h11"/></svg>
      </a>
      <h1>All Categories</h1>
      <div class="categories-top-actions">
        <button class="categories-icon-button" type="button" aria-label="Search categories">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        </button>
        <a class="categories-icon-button" href="/cart.html" aria-label="Open cart">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 5h2l1.6 10.3h10.7L20 8H7.1"/><circle cx="9" cy="20" r="1.4"/><circle cx="17.4" cy="20" r="1.4"/></svg>
          ${cartCount() ? `<strong>${cartCount()}</strong>` : ""}
        </a>
      </div>
    </header>
  `;
}

function renderCategorySidebarItem([label, image], index) {
  return `
    <a class="categories-side-item ${index === 0 ? "active" : ""}" href="#categoryContent">
      <span><img src="${escapeHtml(image)}" alt="" loading="lazy"></span>
      <strong>${escapeHtml(label)}</strong>
    </a>
  `;
}

function renderCategoryStoreCard([title, label, tone]) {
  return `
    <article class="category-store-card ${escapeHtml(tone)}">
      <div>${escapeHtml(title)}</div>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function renderCategoryLaunchCard([title, label, image]) {
  return `
    <article class="category-launch-card">
      <div class="category-launch-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
        <span>${escapeHtml(label)}</span>
      </div>
      <strong>${escapeHtml(title)}</strong>
    </article>
  `;
}

function renderCategoryTryCard([title, tone]) {
  return `
    <article class="category-try-card ${escapeHtml(tone)}">
      <span aria-hidden="true"></span>
      <strong>${escapeHtml(title)}</strong>
    </article>
  `;
}

function renderCategoriesPage() {
  return `
    <main class="categories-page">
      ${renderCategoryTopBar()}
      <div class="categories-layout">
        <aside class="categories-sidebar" aria-label="All categories">
          ${categorySidebarItems.map(renderCategorySidebarItem).join("")}
        </aside>
        <section id="categoryContent" class="categories-content" aria-label="Category collections">
          <section class="categories-section">
            <h2>Popular Store</h2>
            <div class="category-store-grid">
              ${categoryStoreCards.map(renderCategoryStoreCard).join("")}
            </div>
          </section>

          <section class="categories-section">
            <h2>New & Upcoming Launches</h2>
            <div class="category-launch-grid">
              ${categoryLaunchItems.map(renderCategoryLaunchCard).join("")}
              <a class="category-view-all" href="/index.html#featured-products" aria-label="View all launches">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15"/><path d="m5 12 7 7 7-7"/></svg>
                <strong>View All</strong>
              </a>
            </div>
          </section>

          <section class="categories-section">
            <h2>Have you tried?</h2>
            <div class="category-try-grid">
              ${categoryTryItems.map(renderCategoryTryCard).join("")}
            </div>
          </section>

          <section class="categories-section">
            <h2>More on Flipkart</h2>
            <div class="category-try-grid category-more-grid">
              ${categoryMoreItems.map(renderCategoryTryCard).join("")}
            </div>
          </section>

          <details class="category-more-about">
            <summary>More about Allcat L0 Foryou</summary>
            <p>Explore stores, launches, rewards, payments and services grouped for quick browsing.</p>
          </details>
        </section>
      </div>
    </main>
    ${renderBottomNav()}
  `;
}

function renderCloneBackBar(title) {
  return `
    <header class="clone-topbar">
      <a class="clone-back-button" href="/index.html" aria-label="Back to home">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
      </a>
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function renderAccountIcon(icon) {
  const icons = {
    card: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4.5" width="12" height="15" rx="2"/><path d="M8 8h6M8 11h4M4 8.5h3M4 12h3M4 15.5h3"/></svg>`,
    language: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h8"/><path d="M9 3v2"/><path d="M7 5c.5 3.2 2.2 5.8 5 8"/><path d="M12 5c-.5 3-2.4 5.8-6 8"/><path d="M15 21l3.7-9 3.3 9"/><path d="M16.3 18h4.4"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 10a5.5 5.5 0 0 1 11 0v4l2 2.5h-15l2-2.5z"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M18.5 6.2 20 4.7M5.5 6.2 4 4.7"/></svg>`,
    help: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14.5a8 8 0 0 1 16 0v4.2a1.6 1.6 0 0 1-1.6 1.6H16v-6h4"/><path d="M8 20.3H5.6A1.6 1.6 0 0 1 4 18.7v-4.2h4z"/></svg>`,
    shop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1-4H6z"/><path d="M6 9v10h12V9"/><path d="M9 13h6"/></svg>`,
    document: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V7h3"/><path d="M9 11h5M9 14h6M9 17h4"/></svg>`,
    question: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9.8 9.7a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.3 1.9-2.3 3.5"/><path d="M12 17.4h.01"/></svg>`
  };
  return icons[icon] || icons.question;
}

function renderAccountListRow([icon, title, subtitle]) {
  return `
    <a class="account-list-row" href="/login.html?next=${encodeURIComponent("/account.html")}">
      <span class="account-row-icon">${renderAccountIcon(icon)}</span>
      <span>
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      </span>
      <svg class="account-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </a>
  `;
}

function renderAccountPage() {
  return `
    <main class="clone-page account-page">
      ${renderCloneBackBar("Account")}

      <section class="account-login-strip">
        <span>Log in to get exclusive offers</span>
        <a href="/login.html?next=${encodeURIComponent("/account.html")}">Log In</a>
      </section>

      <section class="account-section">
        <h2>Finance On UPI</h2>
        ${renderAccountListRow(["card", "superCard | Buy Now Pay later in 3", "Enjoy 3% cashback | Activate FK UPI and pay in 3 months"])}
      </section>

      <section class="account-section language-section">
        <h2>Try Flipkart in your language</h2>
        <div class="language-chip-row" aria-label="Language options">
          <a href="/login.html">हिंदी</a>
          <a href="/login.html">தமிழ்</a>
          <a href="/login.html">తెలుగు</a>
          <a href="/login.html">ಕನ್ನಡ</a>
          <a class="more" href="/login.html">+8 more</a>
        </div>
      </section>

      <section class="account-section">
        <h2>Account Settings</h2>
        ${accountSettingsRows.map(renderAccountListRow).join("")}
      </section>

      <section class="account-section">
        <h2>Earn with Flipkart</h2>
        ${renderAccountListRow(["shop", "Sell on Flipkart", ""])}
      </section>

      <section class="account-section">
        <h2>Feedback & Information</h2>
        ${accountInfoRows.map(renderAccountListRow).join("")}
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderCartEmptyGraphic() {
  return `
    <div class="cart-empty-graphic" aria-hidden="true">
      <span>f</span>
      <svg viewBox="0 0 160 110">
        <path d="M16 78h128"/>
        <path d="M42 36h14l13 44h48l12-32H64"/>
        <path d="M70 86a7 7 0 1 0 0 .2"/>
        <path d="M112 86a7 7 0 1 0 0 .2"/>
        <path d="M77 58v14M94 58v14M111 58v14"/>
        <path d="M44 58H24M36 70H11"/>
      </svg>
    </div>
  `;
}

function renderPublicCartPage() {
  return `
    <main class="clone-page public-cart-page">
      ${renderCloneBackBar("My Cart")}

      <section class="cart-empty-panel">
        ${renderCartEmptyGraphic()}
        <h2>Missing Cart items?</h2>
        <a class="cart-login-button" href="/login.html?next=${encodeURIComponent("/cart.html")}">Login</a>
        <a class="cart-continue-link" href="/index.html">Continue Shopping</a>
      </section>

      <section class="cart-suggestion-section">
        <h2>Suggested for You</h2>
        <p>Based on Your Activity</p>
        <article class="cart-suggestion-card">
          <img src="${escapeHtml(cartSuggestionProduct.image)}" alt="${escapeHtml(cartSuggestionProduct.title)}" loading="lazy">
          <strong>${escapeHtml(cartSuggestionProduct.title)}</strong>
          <span>${escapeHtml(cartSuggestionProduct.price)}</span>
          <small><b></b>Assured</small>
          <a href="/login.html?next=${encodeURIComponent("/cart.html")}">Add to cart</a>
        </article>
      </section>

      <section class="cart-recent-section">
        <h2>Recently Viewed</h2>
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderHomePage() {
  const products = visibleProducts().slice(0, 8);
  return `
    ${renderHeader()}
    ${renderCategoryStrip()}
    <main class="home-layout market-home flipkart-shell">
      <section class="promo-grid flip-hero" aria-label="Featured offers">
        <button class="hero-arrow prev" type="button" aria-label="Previous offer">&lsaquo;</button>
        ${promoTiles.map((tile, index) => `
          <article class="promo-card ${escapeHtml(tile.tone)} ${index === 0 ? "active" : ""}">
            <img src="${escapeHtml(tile.image)}" alt="${escapeHtml(tile.title)}" loading="${index === 0 ? "eager" : "lazy"}">
            <div>
              <span>${escapeHtml(tile.badge)}</span>
              <h1>${escapeHtml(tile.title)}</h1>
              <p>${escapeHtml(tile.subtitle)}</p>
              <b>${escapeHtml(tile.cta || "Shop Now")}</b>
            </div>
          </article>
        `).join("")}
        <button class="hero-arrow next" type="button" aria-label="Next offer">&rsaquo;</button>
      </section>
      <div class="mobile-promo-dots" aria-hidden="true"><span></span><span class="active"></span><span></span></div>

      <section class="mobile-deal-strip" aria-label="Hot deals">
        ${mobileDealItems.map(renderMobileDealCard).join("")}
      </section>

      <section class="mobile-spotlight" aria-labelledby="spotlightTitle">
        <h2 id="spotlightTitle">Interesting finds</h2>
        <div class="spotlight-grid">
          ${spotlightItems.map(renderSpotlightCard).join("")}
        </div>
      </section>

      <section class="trend-band brand-spotlight" aria-labelledby="trendTitle">
        <h2 id="trendTitle">Brands In Spotlight</h2>
        <div class="trend-strip">
          ${trendItems.map(([label, offer, image]) => `
            <article class="trend-card">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(label)}" loading="lazy">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(offer)}</span>
            </article>
          `).join("")}
        </div>
      </section>

      ${marketplaceRails.map(renderMarketplaceRail).join("")}

      <section id="featured-products" class="market-toolbar">
        <div>
          <h2>People also viewed</h2>
          <p>${escapeHtml(productCacheLabel())} - ${products.length} products showing</p>
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

      <section class="market-product-grid" aria-label="Shopping products">
        ${products.length ? products.map(renderMarketProductCard).join("") : `<div class="empty-state">No products found.</div>`}
      </section>

      <section class="market-faq" aria-labelledby="faqTitle">
        <div>
          <h2 id="faqTitle">Flipkart - Your go-to place for Online Shopping</h2>
        </div>
        <div class="faq-list">
          ${renderFaqItems()}
        </div>
      </section>
    </main>
    <footer class="market-footer">
      <div class="footer-columns">
        <section><h3>About</h3><a>Contact Us</a><a>About Us</a><a>Careers</a><a>Flipkart Stories</a></section>
        <section><h3>Group Companies</h3><a>Myntra</a><a>Cleartrip</a><a>Shopsy</a></section>
        <section><h3>Help</h3><a>Payments</a><a>Shipping</a><a>Cancellation & Returns</a><a>FAQ</a></section>
        <section><h3>Consumer Policy</h3><a>Terms Of Use</a><a>Security</a><a>Privacy</a><a>Grievance Redressal</a></section>
        <section><h3>Mail Us</h3><p>Flipkart Internet Private Limited, Bengaluru, Karnataka, India</p></section>
        <section><h3>Registered Office Address</h3><p>Flipkart Internet Private Limited, Bengaluru, Karnataka, India</p></section>
      </div>
      <div class="footer-bottom"><span>Become a Seller</span><span>Advertise</span><span>Gift Cards</span><span>Help Center</span><strong>2007-2026 Flipkart.com</strong></div>
    </footer>
    ${renderBottomNav()}
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
      ${renderModuleCard("Customer cache", `Cart and order keys are scoped to this Supabase user id.`, `<a class="btn ghost" href="/user/cache.html">View cache</a>`)}
    </section>
  `;
  return renderModuleShell("user", "Customer module", "Customer home for account, cart, checkout and order history.", metrics, content);
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
  if (state.loginView === "email") {
    return `
      <main class="login-page flip-login-page">
        <header class="flip-login-header">
          <a class="flip-login-close" href="/index.html" aria-label="Close login">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </a>
          <a class="flip-login-brand" href="/index.html" aria-label="Flipkart home">
            <span>Flipkart</span><i aria-hidden="true">f</i>
          </a>
        </header>
        <section class="flip-login-sheet flip-email-sheet" aria-labelledby="loginTitle">
          <button class="flip-phone-link" type="button" data-action="login-view" data-view="phone">Use Phone Number</button>
          <h1 id="loginTitle">${state.authMode === "signin" ? "Log in with Email-ID" : "Create account"}</h1>
          <p>Enter your email and password to continue.</p>
          ${renderMessage()}
          <div class="auth-tabs">
            <button class="${state.authMode === "signin" ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signin">Login</button>
            <button class="${state.authMode === "signup" ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signup">Signup</button>
          </div>
          <form class="auth-form flip-email-form" data-form="auth">
            <label>Email<input data-field="auth-email" data-focus-key="auth-email" type="email" autocomplete="email" value="${escapeHtml(state.email)}" required></label>
            <label>Password<input data-field="auth-password" data-focus-key="auth-password" type="password" autocomplete="${state.authMode === "signin" ? "current-password" : "new-password"}" value="${escapeHtml(state.password)}" minlength="6" required></label>
            <button class="flip-login-submit" type="submit" ${state.loading.auth ? "disabled" : ""}>${state.loading.auth ? "Please wait" : state.authMode === "signin" ? "Login" : "Create account"}</button>
          </form>
        </section>
      </main>
    `;
  }

  return `
    <main class="login-page flip-login-page">
      <header class="flip-login-header">
        <a class="flip-login-close" href="/index.html" aria-label="Close login">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </a>
        <a class="flip-login-brand" href="/index.html" aria-label="Flipkart home">
          <span>Flipkart</span><i aria-hidden="true">f</i>
        </a>
      </header>

      <section class="flip-login-sheet" aria-labelledby="loginTitle">
        <h1 id="loginTitle">Log in for the best experience</h1>
        <p>Enter your phone number to continue</p>
        <label class="phone-field">
          <span>Phone Number</span>
          <div class="phone-input">
            <b>+91</b>
            <input data-focus-key="phone-login" type="tel" inputmode="numeric" autocomplete="tel" aria-label="Phone number">
          </div>
        </label>
        <button class="flip-email-link" type="button" data-action="login-view" data-view="email">Use Email-ID</button>
        <p class="login-consent">By continuing, you confirm that you are above 18 years of age, and you agree to the Flipkart's <a href="/login.html">Terms of Use</a> and <a href="/login.html">Privacy Policy</a></p>
      </section>

      <div class="flip-login-bottom">
        <button class="flip-login-continue" type="button" disabled>Continue</button>
      </div>
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
  } else if (page === "categories") {
    app.innerHTML = renderCategoriesPage();
  } else if (page === "account") {
    app.innerHTML = renderAccountPage();
  } else if (page === "publicCart") {
    app.innerHTML = renderPublicCartPage();
  } else if (page === "owner") {
    window.location.href = "/user/index.html";
  } else if (page === "admin") {
    window.location.href = "/user/index.html";
  } else if (page === "monitoring") {
    window.location.href = "/user/index.html";
  } else if (monitoringPages.has(page)) {
    window.location.href = "/user/index.html";
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
    state.loginView = "email";
    clearMessage();
    render();
  }
  if (action === "login-view") {
    state.loginView = button.dataset.view || "phone";
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
    if (page === "home" || page === "categories") {
      await loadProducts();
    } else if (publicPages.has(page)) {
      render();
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

  if (retiredModulePathPattern.test(window.location.pathname)) {
    const target = window.location.pathname.includes("/admin/cache") ? "/user/cache.html" : "/user/index.html";
    window.location.href = state.session ? target : `/login.html?next=${encodeURIComponent(target)}`;
    return;
  }

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
