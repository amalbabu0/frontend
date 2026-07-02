import { hasSupabaseConfig, supabase } from "./lib/supabase.js";
import "./app.css";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const razorpayPaymentUrl = import.meta.env.VITE_RAZORPAY_PAYMENT_URL || "https://razorpay.com/";
const razorpayCheckoutScript = "https://checkout.razorpay.com/v1/checkout.js";
const app = document.querySelector("#app");
const page = document.body.dataset.page || "home";
const protectedPages = new Set(["cart", "orderSummary", "orders", "cache", "user", "payment", "devices", "sellerRegister", "sellerHome", "sellerProducts", "sellerOrders", "sellerAccount"]);
const publicPages = new Set(["home", "categories", "account", "publicCart", "product"]);
const monitoringPages = new Set();
const retiredModulePathPattern = /^\/(owner|admin|development)\//;
const deliveryAddressLegacyKey = "zakiDeliveryAddress";
const deviceStorageKey = "zakiDeviceId";
const cartDbTable = "user_carts";
const deliveryAddressDbTable = "user_delivery_addresses";
const deviceDbTable = "user_devices";
const sellerDbTable = "sellers";
const sellerProductDbTable = "seller_products";

const state = {
  authReady: false,
  authMode: "signin",
  loginView: "email",
  email: "",
  password: "",
  session: null,
  products: [],
  cart: [],
  buyNowQuantity: 1,
  orders: [],
  cache: null,
  health: null,
  productCache: null,
  deliveryAddress: null,
  devices: [],
  seller: null,
  sellerProducts: [],
  paymentAddressEdit: new URLSearchParams(window.location.search).get("step") === "address" || new URLSearchParams(window.location.search).get("edit") === "address",
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
    devices: false,
    seller: false,
    sellerProducts: false,
    action: ""
  }
};

let razorpayCheckoutPromise = null;

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

const starterProducts = [
  {
    id: "pulse-headphones",
    name: "Pulse Wireless Headphones",
    description: "Noise-softening over-ear audio with 40 hours of battery.",
    pricePaise: 249900,
    badge: "Best Deal",
    category: "Electronics",
    rating: "4.8",
    stock: 64,
    delivery: "Today",
    channel: "zaki Assured",
    sku: "SM-1001",
    featured: true,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    alt: "Black wireless headphones on a bright background"
  },
  {
    id: "loop-smartwatch",
    name: "Loop Smart Watch",
    description: "Fitness tracking with calls, steps and sleep insights.",
    pricePaise: 329900,
    badge: "Trending",
    category: "Electronics",
    rating: "4.7",
    stock: 72,
    delivery: "Tomorrow",
    channel: "zaki Assured",
    sku: "SM-1002",
    featured: true,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    alt: "Smart watch with a clean strap on a tabletop"
  },
  {
    id: "city-backpack",
    name: "City Day Backpack",
    description: "Water-resistant daily bag with a padded laptop section.",
    pricePaise: 149900,
    badge: "Travel",
    category: "Bags",
    rating: "4.5",
    stock: 51,
    delivery: "Today",
    channel: "Warehouse",
    sku: "SM-2001",
    featured: true,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
    alt: "Brown backpack photographed in natural light"
  },
  {
    id: "nova-sneakers",
    name: "Nova Run Sneakers",
    description: "Cushioned everyday sneakers with breathable knit support.",
    pricePaise: 219900,
    badge: "Min. 50% Off",
    category: "Footwear",
    rating: "4.6",
    stock: 86,
    delivery: "Tomorrow",
    channel: "zaki Assured",
    sku: "SM-3001",
    featured: true,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    alt: "Red running shoes floating above a red surface"
  },
  {
    id: "arc-keyboard",
    name: "Arc Mechanical Keyboard",
    description: "Compact hot-swap keyboard with quiet tactile switches.",
    pricePaise: 459900,
    badge: "Workstation",
    category: "Electronics",
    rating: "4.9",
    stock: 43,
    delivery: "Today",
    channel: "Marketplace",
    sku: "SM-1003",
    featured: false,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
    alt: "Mechanical keyboard on a desk"
  },
  {
    id: "halo-desk-lamp",
    name: "Halo Desk Lamp",
    description: "Dimmable LED lamp with wireless phone charging base.",
    pricePaise: 189900,
    badge: "Home",
    category: "Home",
    rating: "4.4",
    stock: 38,
    delivery: "Tomorrow",
    channel: "Marketplace",
    sku: "SM-4001",
    featured: false,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
    alt: "Modern desk lamp glowing on a table"
  }
];

const sellerCategories = [
  "Electronics",
  "Fashion & Apparel",
  "Home & Furniture",
  "Grocery & Food",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Books & Media",
  "Toys & Games",
  "Other"
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
  ["zaki Pay", "pay"],
  ["Personal Loan", "loan"],
  ["GenZ trends", "genz"],
  ["Become a Seller", "seller"],
  ["Brand Vouchers", "voucher"]
];

const categoryMoreItems = [
  ["Uber", "uber"],
  ["Pet Supplies", "pet"],
  ["zaki Green", "green"],
  ["zaki Samarth", "samarth"],
  ["zaki Originals", "originals"],
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

function currentUserId() {
  return state.session?.user?.id || "";
}

function createDeviceId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentDeviceId() {
  try {
    const saved = localStorage.getItem(deviceStorageKey);
    if (saved) {
      return saved;
    }
    const nextDeviceId = createDeviceId();
    localStorage.setItem(deviceStorageKey, nextDeviceId);
    return nextDeviceId;
  } catch {
    try {
      const saved = sessionStorage.getItem(deviceStorageKey);
      if (saved) {
        return saved;
      }
      const nextDeviceId = createDeviceId();
      sessionStorage.setItem(deviceStorageKey, nextDeviceId);
      return nextDeviceId;
    } catch {
      return "current-session";
    }
  }
}

function browserName(userAgent = navigator.userAgent) {
  if (/Edg\//.test(userAgent)) {
    return "Microsoft Edge";
  }
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) {
    return "Opera";
  }
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) {
    return "Chrome";
  }
  if (/Firefox\//.test(userAgent)) {
    return "Firefox";
  }
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) {
    return "Safari";
  }
  return "Browser";
}

function osName(userAgent = navigator.userAgent) {
  if (/Windows/i.test(userAgent)) {
    return "Windows";
  }
  if (/Android/i.test(userAgent)) {
    return "Android";
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iOS";
  }
  if (/Mac OS X|Macintosh/i.test(userAgent)) {
    return "macOS";
  }
  if (/Linux/i.test(userAgent)) {
    return "Linux";
  }
  return "Unknown OS";
}

function deviceType(userAgent = navigator.userAgent) {
  if (/iPad|Tablet/i.test(userAgent)) {
    return "Tablet";
  }
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) {
    return "Mobile";
  }
  return "Desktop";
}

function currentDevicePayload() {
  const ua = navigator.userAgent || "";
  const browser = browserName(ua);
  const os = osName(ua);
  const type = deviceType(ua);
  return {
    user_id: currentUserId(),
    device_id: currentDeviceId(),
    device_name: `${browser} on ${os}`,
    browser_name: browser,
    os_name: os,
    device_type: type,
    user_agent: ua.slice(0, 500),
    last_seen_at: new Date().toISOString(),
    signed_out_at: null
  };
}

function deliveryAddressStorageKey() {
  const userKey = state.session?.user?.id || currentUserEmail() || "guest";
  return `${deliveryAddressLegacyKey}:${encodeURIComponent(userKey)}`;
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

let starterCatalog = null;

function starterCatalogProducts() {
  if (!starterCatalog) {
    starterCatalog = starterProducts.map(enrichProduct);
  }
  return starterCatalog;
}

function catalogProducts() {
  return state.products.length ? state.products : starterCatalogProducts();
}

function categories() {
  return ["all", ...new Set(catalogProducts().map((product) => product.category || "General"))];
}

function productById(productId) {
  return catalogProducts().find((product) => product.id === productId);
}

function mergeCatalogProducts(baseProducts = [], sellerProducts = []) {
  const seenIds = new Set();
  return [...sellerProducts, ...baseProducts].filter((product) => {
    if (!product?.id || seenIds.has(product.id)) {
      return false;
    }
    seenIds.add(product.id);
    return true;
  });
}

function productDetailHref(product) {
  return `/product/?id=${encodeURIComponent(product.id)}`;
}

function safeLocalPath(value, fallback = "/cart/summary/") {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}

function currentLocalPath() {
  return safeLocalPath(`${window.location.pathname}${window.location.search}`, "/");
}

function paymentAddressReturnPath() {
  return safeLocalPath(new URLSearchParams(window.location.search).get("next"), "/cart/summary/");
}

function buyNowSummaryPath(productId) {
  return `/cart/summary/?productId=${encodeURIComponent(productId)}`;
}

function checkoutProductId() {
  return new URLSearchParams(window.location.search).get("productId") || "";
}

function isBuyNowCheckout() {
  return page === "orderSummary" && Boolean(checkoutProductId());
}

function checkoutMode() {
  return isBuyNowCheckout() ? "buyNow" : "cart";
}

function orderSummaryReturnPath() {
  const productId = checkoutProductId();
  return productId ? buyNowSummaryPath(productId) : "/cart/summary/";
}

function defaultBackFallback() {
  if (page === "orderSummary") {
    return "/cart/";
  }
  if (page === "payment") {
    return "/cart/summary/";
  }
  if (page === "sellerRegister" || page === "sellerHome") {
    return "/account/";
  }
  if (page === "sellerProducts" || page === "sellerOrders" || page === "sellerAccount") {
    return "/seller/";
  }
  if (page === "devices") {
    return "/account/";
  }
  if (page === "account" || page === "cart" || page === "publicCart") {
    return isSignedIn() ? "/user/" : "/";
  }
  return "/";
}

function sellerEntryHref() {
  return isSignedIn() ? "/seller/register/" : `/login/?next=${encodeURIComponent("/seller/register/")}`;
}

function navigateBack(fallback = defaultBackFallback()) {
  const target = safeLocalPath(fallback, "/");
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = target;
}

function stableProductSeed(product) {
  return String(product?.id || product?.name || "zaki")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function productDiscountPercent(product) {
  return 55 + (stableProductSeed(product) % 35);
}

function productListPricePaise(product) {
  const discount = productDiscountPercent(product);
  return Math.max(product.pricePaise + 100, Math.round(product.pricePaise / (1 - discount / 100)));
}

function currentProduct() {
  const productId = new URLSearchParams(window.location.search).get("id");
  return productById(productId) || catalogProducts()[0] || null;
}

function relatedProducts(product, limit = 8) {
  const products = catalogProducts();
  const sameCategory = products.filter((item) => item.id !== product?.id && item.category === product?.category);
  const otherProducts = products.filter((item) => item.id !== product?.id && item.category !== product?.category);
  return [...sameCategory, ...otherProducts].slice(0, limit);
}

function cartCount(items = state.cart) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function cartTotalPaise(items = state.cart) {
  return items.reduce((sum, item) => sum + Number(item.lineTotalPaise || item.pricePaise * item.quantity || 0), 0);
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
  if (state.productCache.source === "starter-catalog") {
    return "Featured picks";
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
  const filtered = catalogProducts().filter((product) => {
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

function normalizeCartItem(item) {
  const product = productById(item?.productId);
  const quantity = Math.min(Math.max(Number(item?.quantity || 1), 1), 20);
  const pricePaise = Number(product?.pricePaise ?? item?.pricePaise ?? 0);
  return {
    productId: product?.id || item?.productId,
    name: product?.name || item?.name || item?.productId || "Product",
    pricePaise,
    quantity,
    lineTotalPaise: pricePaise * quantity
  };
}

function normalizeCartItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.productId)
    .map(normalizeCartItem);
}

function checkoutItems() {
  const productId = checkoutProductId();
  if (isBuyNowCheckout()) {
    const product = productById(productId);
    return product ? [normalizeCartItem({ productId: product.id, quantity: state.buyNowQuantity })] : [];
  }

  return state.cart;
}

function canUseCartDb() {
  return Boolean(supabase && currentUserId());
}

async function readCartFromDb() {
  if (!canUseCartDb()) {
    return { ok: false, error: new Error("Supabase cart DB is not configured.") };
  }

  const { data, error } = await supabase
    .from(cartDbTable)
    .select("items")
    .eq("user_id", currentUserId())
    .maybeSingle();

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    exists: Boolean(data),
    cart: normalizeCartItems(data?.items || [])
  };
}

async function writeCartToDb(items) {
  if (!canUseCartDb()) {
    return;
  }

  const { error } = await supabase
    .from(cartDbTable)
    .upsert({
      user_id: currentUserId(),
      items: normalizeCartItems(items),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

async function readCartFromBackend() {
  const data = await apiRequest("/api/cart");
  return normalizeCartItems(data.cart || []);
}

async function writeCartToBackend(items) {
  const data = await apiRequest("/api/cart", {
    method: "PUT",
    body: JSON.stringify({ items: cartPayload(items) })
  });
  return normalizeCartItems(data.cart || items);
}

function canUseDeviceDb() {
  return Boolean(supabase && currentUserId());
}

function normalizeDevice(row = {}) {
  return {
    userId: row.user_id || currentUserId(),
    deviceId: row.device_id || "",
    deviceName: row.device_name || "Unknown device",
    browserName: row.browser_name || "Browser",
    osName: row.os_name || "Unknown OS",
    deviceType: row.device_type || "Device",
    userAgent: row.user_agent || "",
    firstSeenAt: row.first_seen_at || "",
    lastSeenAt: row.last_seen_at || "",
    signedOutAt: row.signed_out_at || ""
  };
}

async function registerCurrentDevice() {
  if (!canUseDeviceDb()) {
    return { ok: false, error: new Error("Supabase device DB is not configured.") };
  }

  const { error } = await supabase
    .from(deviceDbTable)
    .upsert(currentDevicePayload(), { onConflict: "user_id,device_id" });

  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}

async function readDevicesFromDb() {
  if (!canUseDeviceDb()) {
    return { ok: false, error: new Error("Supabase device DB is not configured.") };
  }

  const { data, error } = await supabase
    .from(deviceDbTable)
    .select("user_id, device_id, device_name, browser_name, os_name, device_type, user_agent, first_seen_at, last_seen_at, signed_out_at")
    .eq("user_id", currentUserId())
    .is("signed_out_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    devices: (data || []).map(normalizeDevice)
  };
}

async function markCurrentDeviceSignedOut() {
  if (!canUseDeviceDb()) {
    return;
  }

  const now = new Date().toISOString();
  await supabase
    .from(deviceDbTable)
    .update({ signed_out_at: now, last_seen_at: now })
    .eq("user_id", currentUserId())
    .eq("device_id", currentDeviceId());
}

function canUseSellerDb() {
  return Boolean(supabase && currentUserId());
}

function normalizeSeller(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || "",
    userId: row.user_id || currentUserId(),
    storeName: row.store_name || "",
    businessType: row.business_type || "",
    category: row.category || "",
    gstNumber: row.gst_number || "",
    description: row.description || "",
    contactPhone: row.contact_phone || "",
    pickupPincode: row.pickup_pincode || "",
    pickupCity: row.pickup_city || "",
    status: row.status || "pending",
    commissionRate: Number(row.commission_rate || 5),
    totalProducts: Number(row.total_products || 0),
    totalOrders: Number(row.total_orders || 0),
    totalRevenue: Number(row.total_revenue || 0),
    rating: Number(row.rating || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function sellerDbPayload(formData) {
  const gstNumber = String(formData.get("gstNumber") || "").trim().toUpperCase();
  return {
    user_id: currentUserId(),
    store_name: String(formData.get("storeName") || "").trim(),
    business_type: String(formData.get("businessType") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    gst_number: gstNumber || null,
    description: String(formData.get("description") || "").trim() || null,
    contact_phone: String(formData.get("contactPhone") || "").trim(),
    pickup_pincode: String(formData.get("pickupPincode") || "").trim(),
    pickup_city: String(formData.get("pickupCity") || "").trim(),
    updated_at: new Date().toISOString()
  };
}

async function readSellerFromDb() {
  if (!canUseSellerDb()) {
    return { ok: false, error: new Error("Supabase seller DB is not configured.") };
  }

  const { data, error } = await supabase
    .from(sellerDbTable)
    .select("*")
    .eq("user_id", currentUserId())
    .maybeSingle();

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    exists: Boolean(data),
    seller: data ? normalizeSeller(data) : null
  };
}

async function writeSellerToDb(formData) {
  if (!canUseSellerDb()) {
    throw new Error("Supabase seller DB is not configured.");
  }

  const { data, error } = await supabase
    .from(sellerDbTable)
    .upsert(sellerDbPayload(formData), { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeSeller(data);
}

function canUseSellerProductDb() {
  return Boolean(supabase && currentUserId() && state.seller?.id);
}

function normalizeSellerProduct(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || "",
    sellerId: row.seller_id || "",
    userId: row.user_id || currentUserId(),
    name: row.name || "",
    category: row.category || "",
    pricePaise: Number(row.price_paise || 0),
    stock: Number(row.stock || 0),
    imageUrl: row.image_url || "",
    description: row.description || "",
    status: row.status || "draft",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function normalizePublicSellerProduct(row = {}, index = 0) {
  const product = normalizeSellerProduct(row);
  if (!product?.id || product.status !== "active") {
    return null;
  }

  const shortId = product.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return enrichProduct({
    id: `seller-${product.id}`,
    name: product.name,
    description: product.description || `${product.category} from a zaki seller`,
    pricePaise: product.pricePaise,
    badge: "Seller listing",
    category: product.category || "Seller Store",
    stock: product.stock,
    image: product.imageUrl || fallbackImages[index % fallbackImages.length],
    alt: `${product.name} seller product image`,
    rating: "4.4",
    delivery: "Tomorrow",
    channel: "zaki Seller",
    sku: `SELL-${shortId}`,
    featured: true,
    sellerProductId: product.id
  }, index);
}

function sellerProductDbPayload(formData) {
  const priceRupees = Number(formData.get("price") || 0);
  return {
    seller_id: state.seller.id,
    user_id: currentUserId(),
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    price_paise: Math.round(priceRupees * 100),
    stock: Math.max(0, Number.parseInt(formData.get("stock") || "0", 10) || 0),
    image_url: String(formData.get("imageUrl") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    status: String(formData.get("status") || "active").trim() || "active",
    updated_at: new Date().toISOString()
  };
}

async function readPublicSellerProductsFromDb() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(sellerProductDbTable)
    .select("id, seller_id, user_id, name, category, price_paise, stock, image_url, description, status, created_at, updated_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map(normalizePublicSellerProduct)
    .filter(Boolean);
}

async function readSellerProductsFromDb() {
  if (!canUseSellerProductDb()) {
    return { ok: false, error: new Error("Supabase seller product DB is not configured.") };
  }

  const { data, error } = await supabase
    .from(sellerProductDbTable)
    .select("*")
    .eq("user_id", currentUserId())
    .eq("seller_id", state.seller.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    products: Array.isArray(data) ? data.map(normalizeSellerProduct).filter(Boolean) : []
  };
}

async function writeSellerProductToDb(formData) {
  if (!canUseSellerProductDb()) {
    throw new Error("Supabase seller product DB is not configured.");
  }

  const { data, error } = await supabase
    .from(sellerProductDbTable)
    .insert(sellerProductDbPayload(formData))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeSellerProduct(data);
}

async function updateSellerProductStatusInDb(productId, status) {
  if (!canUseSellerProductDb()) {
    throw new Error("Supabase seller product DB is not configured.");
  }

  const { data, error } = await supabase
    .from(sellerProductDbTable)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("user_id", currentUserId())
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeSellerProduct(data);
}

async function syncSellerProductCount(totalProducts) {
  if (!canUseSellerDb()) {
    return;
  }

  await supabase
    .from(sellerDbTable)
    .update({ total_products: totalProducts, updated_at: new Date().toISOString() })
    .eq("user_id", currentUserId());
}

async function sellerHomeForCurrentUser(fallback = "/user/") {
  const result = await readSellerFromDb();
  return result.ok && result.exists ? "/seller/" : fallback;
}

async function postLoginRedirectPath(requestedNext = "") {
  const sellerPath = await sellerHomeForCurrentUser("");
  if (sellerPath === "/seller/") {
    const nextPath = requestedNext ? safeLocalPath(requestedNext, "/seller/") : "";
    return nextPath === "/seller" || nextPath.startsWith("/seller/") ? nextPath : "/seller/";
  }

  return requestedNext ? safeLocalPath(requestedNext, "/user/") : "/user/";
}

function normalizePaymentAddress(address = {}) {
  return {
    fullName: String(address.fullName || address.full_name || "").trim(),
    phone: String(address.phone || "").trim(),
    address: String(address.address || "").trim(),
    pincode: String(address.pincode || "").trim(),
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim()
  };
}

function hasPaymentAddressValue(address = {}) {
  return Object.values(normalizePaymentAddress(address)).some(Boolean);
}

function paymentAddressDbPayload(address) {
  const normalized = normalizePaymentAddress(address);
  return {
    user_id: currentUserId(),
    full_name: normalized.fullName,
    phone: normalized.phone,
    address: normalized.address,
    pincode: normalized.pincode,
    city: normalized.city,
    state: normalized.state,
    updated_at: new Date().toISOString()
  };
}

function paymentAddressFromDb(row) {
  return normalizePaymentAddress({
    fullName: row?.full_name,
    phone: row?.phone,
    address: row?.address,
    pincode: row?.pincode,
    city: row?.city,
    state: row?.state
  });
}

function canUseDeliveryAddressDb() {
  return Boolean(supabase && currentUserId());
}

async function readPaymentAddressFromDb() {
  if (!canUseDeliveryAddressDb()) {
    return { ok: false, error: new Error("Supabase delivery address DB is not configured.") };
  }

  const { data, error } = await supabase
    .from(deliveryAddressDbTable)
    .select("full_name, phone, address, pincode, city, state")
    .eq("user_id", currentUserId())
    .maybeSingle();

  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    exists: Boolean(data),
    address: data ? paymentAddressFromDb(data) : {}
  };
}

async function writePaymentAddressToDb(address) {
  if (!canUseDeliveryAddressDb()) {
    return;
  }

  const { error } = await supabase
    .from(deliveryAddressDbTable)
    .upsert(paymentAddressDbPayload(address), { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

async function loadPaymentAddress() {
  if (!isSignedIn()) {
    state.deliveryAddress = null;
    return;
  }

  const fallbackAddress = localPaymentAddress();
  const dbResult = await readPaymentAddressFromDb();
  if (dbResult.ok && dbResult.exists) {
    state.deliveryAddress = dbResult.address;
    savePaymentAddress(dbResult.address);
    render();
    return;
  }

  state.deliveryAddress = fallbackAddress;
  if (dbResult.ok && isPaymentAddressComplete(fallbackAddress)) {
    writePaymentAddressToDb(fallbackAddress).catch(() => {});
  }
  render();
}

async function persistPaymentAddress(address) {
  const normalized = normalizePaymentAddress(address);
  state.deliveryAddress = normalized;
  savePaymentAddress(normalized);
  try {
    await writePaymentAddressToDb(normalized);
    return true;
  } catch {
    return false;
  }
}

async function loadProducts() {
  state.loading.products = true;
  render();
  let liveSellerProducts = [];
  try {
    liveSellerProducts = await readPublicSellerProductsFromDb();
  } catch {
    liveSellerProducts = [];
  }
  try {
    const data = await apiRequest("/api/products");
    const baseProducts = (data.products || []).map(enrichProduct);
    state.products = mergeCatalogProducts(baseProducts, liveSellerProducts);
    state.productCache = { ...(data.cache || {}), sellerProducts: liveSellerProducts.length };
  } catch (error) {
    state.products = mergeCatalogProducts(starterCatalogProducts(), liveSellerProducts);
    state.productCache = { enabled: false, source: "starter-catalog", hit: false, sellerProducts: liveSellerProducts.length };
    if (page !== "home" && page !== "categories" && page !== "product") {
      setMessage(error.message, "error");
    }
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
    const dbResult = await readCartFromDb();
    if (dbResult.ok && dbResult.exists) {
      state.cart = dbResult.cart;
      writeCartToBackend(state.cart).catch(() => {});
      return;
    }

    const backendCart = await readCartFromBackend();
    state.cart = backendCart;
    if (dbResult.ok && backendCart.length) {
      writeCartToDb(backendCart).catch(() => {});
    }
  } catch (error) {
    const dbResult = await readCartFromDb();
    if (dbResult.ok) {
      state.cart = dbResult.cart;
    } else {
      setMessage(error.message || dbResult.error?.message || "Could not load cart.", "error");
    }
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

async function loadDevices() {
  if (!isSignedIn()) {
    state.devices = [];
    return;
  }

  state.loading.devices = true;
  render();
  try {
    const registerResult = await registerCurrentDevice();
    const dbResult = await readDevicesFromDb();
    if (!dbResult.ok) {
      throw dbResult.error || registerResult.error;
    }
    state.devices = dbResult.devices;
    if (!registerResult.ok) {
      setMessage(registerResult.error?.message || "Could not refresh this device.", "error");
    }
  } catch (error) {
    state.devices = [];
    setMessage(error.message || "Could not load signed-in devices.", "error");
  } finally {
    state.loading.devices = false;
    render();
  }
}

async function loadSellerProfile() {
  if (!isSignedIn()) {
    state.seller = null;
    state.sellerProducts = [];
    return;
  }

  state.loading.seller = true;
  render();
  try {
    const result = await readSellerFromDb();
    if (!result.ok) {
      throw result.error;
    }
    state.seller = result.seller;
  } catch (error) {
    state.seller = null;
    if (page.startsWith("seller")) {
      setMessage(error.message || "Could not load seller profile. Run the sellers SQL in Supabase first.", "error");
    }
  } finally {
    state.loading.seller = false;
    render();
  }
}

async function loadSellerProducts() {
  if (!state.seller) {
    state.sellerProducts = [];
    return;
  }

  state.loading.sellerProducts = true;
  render();
  try {
    const result = await readSellerProductsFromDb();
    if (!result.ok) {
      throw result.error;
    }
    state.sellerProducts = result.products;
    if (state.seller) {
      state.seller.totalProducts = result.products.length;
    }
  } catch (error) {
    state.sellerProducts = [];
    if (page === "sellerProducts") {
      setMessage(error.message || "Could not load seller products. Run the seller products SQL in Supabase first.", "error");
    }
  } finally {
    state.loading.sellerProducts = false;
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

  if (page === "categories" || page === "product") {
    if (isSignedIn()) {
      await Promise.all([loadProducts(), loadCart(), loadCache()]);
      return;
    }
    await loadProducts();
    return;
  }

  if (page === "account") {
    return;
  }

  if (page === "publicCart") {
    if (isSignedIn()) {
      await Promise.all([loadProducts(), loadCart(), loadPaymentAddress(), loadCache()]);
      return;
    }
    await loadProducts();
    return;
  }

  if (!isSignedIn()) {
    return;
  }

  if (page === "cart" || page === "orderSummary" || page === "payment") {
    await Promise.all([loadProducts(), loadCart(), loadPaymentAddress(), loadCache()]);
  }
  if (page === "orders") {
    await Promise.all([loadOrders(), loadCache()]);
  }
  if (page === "devices") {
    await loadDevices();
  }
  if (page === "sellerRegister" || page === "sellerHome" || page === "sellerProducts" || page === "sellerOrders" || page === "sellerAccount") {
    await loadSellerProfile();
    if (page === "sellerRegister" && state.seller) {
      window.location.href = "/seller/";
      return;
    }
    if ((page === "sellerHome" || page === "sellerProducts" || page === "sellerOrders" || page === "sellerAccount") && !state.seller) {
      window.location.href = "/seller/register/";
      return;
    }
    if ((page === "sellerHome" || page === "sellerProducts") && state.seller) {
      await loadSellerProducts();
    }
  }
  if (page === "cache" || page === "user" || page === "owner" || page === "admin") {
    await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache()]);
  }
  if (monitoringPages.has(page)) {
    await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache(), loadHealth()]);
  }
}

async function saveCart(nextCart) {
  state.cart = normalizeCartItems(nextCart);
  render();
  const errors = [];

  try {
    await writeCartToDb(state.cart);
  } catch (error) {
    errors.push(error);
  }

  try {
    state.cart = await writeCartToBackend(state.cart);
    writeCartToDb(state.cart).catch(() => {});
    await loadCache();
  } catch (error) {
    errors.push(error);
  }

  if (errors.length >= 2 || (errors.length && !canUseCartDb())) {
    throw errors[0];
  }

  render();
}

function cartWithAddedProduct(productId) {
  const product = productById(productId);
  if (!product) {
    return null;
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

  return { product, nextCart };
}

async function addToCart(productId, goToCart = false) {
  clearMessage();
  if (!isSignedIn()) {
    const nextUrl = goToCart ? "/cart/" : "/";
    window.location.href = `/login/?next=${encodeURIComponent(nextUrl)}`;
    return;
  }

  const preparedCart = cartWithAddedProduct(productId);
  if (!preparedCart) {
    return;
  }
  const { product, nextCart } = preparedCart;

  try {
    state.loading.action = productId;
    render();
    await saveCart(nextCart);
    if (goToCart) {
      window.location.href = "/cart/";
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

async function buyNow(productId) {
  clearMessage();
  const product = productById(productId);
  if (!product) {
    setMessage("This product is not available right now.", "error");
    return;
  }

  const targetPath = buyNowSummaryPath(product.id);
  if (!isSignedIn()) {
    window.location.href = `/login/?next=${encodeURIComponent(targetPath)}`;
    return;
  }

  window.location.href = targetPath;
}

function goToPayment() {
  clearMessage();
  if (!isSignedIn()) {
    window.location.href = `/login/?next=${encodeURIComponent("/cart/summary/")}`;
    return;
  }
  if (!state.cart.length) {
    setMessage("Add an item before continuing to payment.", "error");
    return;
  }
  window.location.href = "/cart/summary/";
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

function updateBuyNowQuantity(productId, direction) {
  clearMessage();
  if (productId !== checkoutProductId()) {
    return;
  }

  state.buyNowQuantity = Math.min(Math.max(Number(state.buyNowQuantity || 1) + direction, 1), 20);
  render();
}

async function clearCart() {
  clearMessage();
  try {
    state.loading.action = "clear-cart";
    render();
    const errors = [];
    try {
      await writeCartToDb([]);
    } catch (error) {
      errors.push(error);
    }
    try {
      const data = await apiRequest("/api/cart", { method: "DELETE" });
      state.cart = normalizeCartItems(data.cart || []);
    } catch (error) {
      errors.push(error);
      state.cart = [];
    }

    if (errors.length >= 2 || (errors.length && !canUseCartDb())) {
      throw errors[0];
    }

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
    writeCartToDb([]).catch(() => {});
    setMessage(`${data.order.id} saved as ${data.order.status}.`);
    await Promise.all([loadOrders(), loadCache()]);
    if (status === "success") {
      window.location.href = "/user/orders/";
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

    await registerCurrentDevice();
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const nextUrl = await postLoginRedirectPath(requestedNext);
    window.location.href = nextUrl;
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    state.loading.auth = false;
    render();
  }
}

function hasPaymentLinkFallback() {
  return Boolean(razorpayPaymentUrl && razorpayPaymentUrl !== "https://razorpay.com/");
}

function loadRazorpayCheckout() {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayCheckoutPromise) {
    razorpayCheckoutPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = razorpayCheckoutScript;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
      document.head.appendChild(script);
    });
  }

  return razorpayCheckoutPromise;
}

function createRazorpayOptions(orderData, address, resolve, reject, items = state.cart, mode = "cart") {
  let settled = false;
  const itemCount = cartCount(items);
  const finish = (callback) => {
    if (settled) {
      return;
    }
    settled = true;
    callback();
  };

  return {
    key: orderData.keyId,
    amount: orderData.order.amount,
    currency: orderData.order.currency || "INR",
    name: "zaki",
    description: `${itemCount} item${itemCount === 1 ? "" : "s"} ${mode === "buyNow" ? "for Buy Now" : "from your cart"}`,
    order_id: orderData.order.id,
    prefill: {
      name: address.fullName || currentUserName(),
      email: currentUserEmail(),
      contact: address.phone || ""
    },
    notes: {
      city: address.city || "",
      pincode: address.pincode || ""
    },
    theme: {
      color: "#2874f0"
    },
    handler: async (response) => {
      try {
        const data = await apiRequest("/api/payments/razorpay/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          })
        });
        finish(() => resolve(data));
      } catch (error) {
        finish(() => reject(error));
      }
    },
    modal: {
      ondismiss: () => finish(() => reject(new Error("Payment cancelled before completion.")))
    }
  };
}

async function startRazorpayPayment(address, items = state.cart, mode = "cart") {
  const orderData = await apiRequest("/api/payments/razorpay/order", {
    method: "POST",
    body: JSON.stringify({
      address,
      checkoutMode: mode,
      items: cartPayload(items)
    })
  });
  await loadRazorpayCheckout();

  const data = await new Promise((resolve, reject) => {
    const checkout = new window.Razorpay(createRazorpayOptions(orderData, address, resolve, reject, items, mode));
    checkout.on("payment.failed", (response) => {
      const description = response?.error?.description || response?.error?.reason || "Payment failed.";
      reject(new Error(description));
    });
    checkout.open();
  });

  if (mode === "cart") {
    state.cart = [];
    writeCartToDb([]).catch(() => {});
  }
  state.orders = data.order ? [data.order, ...state.orders] : state.orders;
  window.location.href = "/user/orders/";
}

async function continuePayment() {
  clearMessage();
  const items = checkoutItems();
  const mode = checkoutMode();
  if (!items.length) {
    setMessage("Add an item before continuing to payment.", "error");
    return;
  }

  const address = savedPaymentAddress();
  if (!isPaymentAddressComplete(address)) {
    state.paymentAddressEdit = true;
    setMessage("Add a delivery address before payment.", "error");
    return;
  }

  state.loading.action = "payment";
  render();
  try {
    const paymentItems = normalizeCartItems(items);
    if (mode === "cart") {
      state.cart = paymentItems;
      writeCartToBackend(paymentItems).catch(() => {});
      writeCartToDb(paymentItems).catch(() => {});
    }
    await startRazorpayPayment(address, paymentItems, mode);
  } catch (error) {
    if (hasPaymentLinkFallback() && error.message.includes("Razorpay backend env vars are not configured")) {
      window.location.href = razorpayPaymentUrl;
      return;
    }

    state.loading.action = "";
    setMessage(error.message, "error");
  }
}

async function submitPaymentAddress(form) {
  clearMessage();
  if (!checkoutItems().length) {
    setMessage("Add an item before continuing to payment.", "error");
    return;
  }

  const formData = new FormData(form);
  const address = Object.fromEntries(formData.entries());
  await persistPaymentAddress(address);

  if (state.paymentAddressEdit || page === "orderSummary") {
    state.paymentAddressEdit = false;
    window.location.href = page === "orderSummary" ? orderSummaryReturnPath() : paymentAddressReturnPath();
    return;
  }

  state.paymentAddressEdit = false;
  await continuePayment();
}

async function submitSellerRegistration(form) {
  clearMessage();
  const formData = new FormData(form);
  const storeName = String(formData.get("storeName") || "").trim();
  const businessType = String(formData.get("businessType") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const pickupPincode = String(formData.get("pickupPincode") || "").trim();
  const pickupCity = String(formData.get("pickupCity") || "").trim();
  const gstNumber = String(formData.get("gstNumber") || "").trim().toUpperCase();
  const errors = [];

  if (storeName.length < 3) {
    errors.push("Store name must be at least 3 characters.");
  }
  if (!businessType) {
    errors.push("Choose a business type.");
  }
  if (!category) {
    errors.push("Choose a product category.");
  }
  if (!/^[6-9]\d{9}$/.test(contactPhone)) {
    errors.push("Enter a valid 10 digit Indian phone number.");
  }
  if (!/^\d{6}$/.test(pickupPincode)) {
    errors.push("Enter a valid 6 digit pickup pincode.");
  }
  if (pickupCity.length < 2) {
    errors.push("Enter your pickup city.");
  }
  if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) {
    errors.push("GST number must be 15 alphanumeric characters.");
  }
  if (!formData.get("agreeTerms")) {
    errors.push("Accept the seller terms to continue.");
  }

  if (errors.length) {
    setMessage(errors[0], "error");
    return;
  }

  try {
    state.loading.action = "seller-registration";
    render();
    state.seller = await writeSellerToDb(formData);
    setMessage("Seller registration submitted successfully.");
    window.location.href = "/seller/";
  } catch (error) {
    const message = error.message?.includes("contact_phone")
      ? "Update your sellers SQL in Supabase, then submit again."
      : error.message || "Could not submit seller registration.";
    setMessage(message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function submitSellerProduct(form) {
  clearMessage();
  if (!state.seller) {
    setMessage("Create your seller profile before adding products.", "error");
    return;
  }

  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const price = Number(formData.get("price") || 0);
  const stockValue = String(formData.get("stock") || "").trim();
  const stock = Number.parseInt(stockValue || "0", 10);
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const status = String(formData.get("status") || "draft").trim();
  const errors = [];

  if (name.length < 3) {
    errors.push("Product name must be at least 3 characters.");
  }
  if (!category) {
    errors.push("Choose a product category.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    errors.push("Enter a valid product price.");
  }
  if (stockValue && (!Number.isInteger(stock) || stock < 0)) {
    errors.push("Stock must be zero or more.");
  }
  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        errors.push("Image URL must start with http or https.");
      }
    } catch {
      errors.push("Enter a valid image URL.");
    }
  }
  if (!["draft", "active", "paused"].includes(status)) {
    errors.push("Choose a valid listing status.");
  }

  if (errors.length) {
    setMessage(errors[0], "error");
    return;
  }

  try {
    state.loading.action = "seller-product";
    render();
    const product = await writeSellerProductToDb(formData);
    state.sellerProducts = [product, ...state.sellerProducts];
    if (state.seller) {
      state.seller.totalProducts = state.sellerProducts.length;
    }
    await syncSellerProductCount(state.sellerProducts.length).catch(() => {});
    form.reset();
    setMessage("Product added successfully.");
  } catch (error) {
    const message = error.message?.includes(sellerProductDbTable)
      ? "Run the seller products SQL in Supabase, then add the product again."
      : error.message || "Could not add product.";
    setMessage(message, "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function updateSellerProductStatus(productId, status) {
  clearMessage();
  if (!productId || !["active", "paused", "draft"].includes(status)) {
    setMessage("Choose a valid product status.", "error");
    return;
  }

  try {
    state.loading.action = `seller-product-status:${productId}`;
    render();
    const product = await updateSellerProductStatusInDb(productId, status);
    state.sellerProducts = state.sellerProducts.map((item) => item.id === product.id ? product : item);
    setMessage(status === "active" ? "Product is live for other users." : "Product is paused.");
  } catch (error) {
    setMessage(error.message || "Could not update product status.", "error");
  } finally {
    state.loading.action = "";
    render();
  }
}

async function signOut() {
  if (supabase) {
    await markCurrentDeviceSignedOut().catch(() => {});
    await supabase.auth.signOut();
  }
  state.session = null;
  state.cart = [];
  state.orders = [];
  state.cache = null;
  state.health = null;
  state.deliveryAddress = null;
  state.devices = [];
  state.seller = null;
  state.sellerProducts = [];
  window.location.href = "/login/";
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
        <div class="brand-mark">z</div>
        <div>
          <h1>zaki</h1>
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
      ${bottomNavLink("/development/soc/", "S", "SOC", "soc")}
      ${bottomNavLink("/development/system/", "M", "System", "system")}
      ${bottomNavLink("/development/web-analytics/", "W", "Web", "webAnalytics")}
      ${bottomNavLink("/development/speed-insights/", "F", "Speed", "speedInsights")}
      ${bottomNavLink("/development/observability/", "O", "Observe", "observability")}
      ${bottomNavLink("/development/analytics/", "A", "Analytics", "analytics")}
    </nav>
  `;
}

function renderBottomNav() {
  const homeHref = isSignedIn() ? "/user/" : "/";
  return `
    <nav class="bottom-nav module-bottom-nav" aria-label="Customer navigation">
      ${bottomNavLink(homeHref, "home", "Home", ["home", "user"])}
      ${bottomNavLink("/categories/", "categories", "Categories", "categories")}
      ${bottomNavLink("/account/", "account", "Account", ["account", "devices", "orders", "cache"])}
      ${bottomNavLink("/cart/", "cart", "Cart", ["publicCart", "cart"], cartCount() ? String(cartCount()) : "")}
    </nav>
  `;
}

function renderHeader() {
  const homeHref = isSignedIn() ? "/user/" : "/";
  return `
    <header class="top-header customer-header">
      <div class="brand-tabs" aria-label="zaki services">
        <a class="brand-tab primary" href="${homeHref}" aria-label="zaki home">
          <span class="flip-mark">z</span>
          <span class="brand-stack"><span>zaki</span><small>Explore Plus</small></span>
        </a>
        <a class="brand-tab travel" href="/#featured-products">
          <span class="travel-mark">Air</span>
          <span>Travel</span>
        </a>
      </div>
      <div class="delivery-location">
        <span class="pin-dot" aria-hidden="true"></span>
        <span>Location not set</span>
        <a href="/login/">Select delivery location</a>
      </div>
      <div class="search-wrap market-search">
        <span class="search-icon" aria-hidden="true"></span>
        <input data-filter="query" data-focus-key="search" type="search" value="${escapeHtml(state.filters.query)}" placeholder="Search for Products, Brands and More">
      </div>
      <nav class="header-actions" aria-label="Customer actions">
        ${isSignedIn() ? `<span class="signed-user" title="${escapeHtml(currentUserEmail())}">${escapeHtml(currentUserEmail())}</span><button class="logout-button" type="button" data-action="sign-out">Logout</button>` : `<a class="header-action login-action" href="/login/"><span class="person-icon" aria-hidden="true"></span><span>Login</span><span class="chevron">v</span></a>`}
        <a class="header-action seller-action" href="${sellerEntryHref()}"><span class="seller-icon" aria-hidden="true"></span><span>Become a Seller</span></a>
        <button class="header-action more-action" type="button"><span>More</span><span class="chevron">v</span></button>
        <a class="header-action cart-action" href="/cart/"><span class="cart-icon" aria-hidden="true"></span><span>Cart</span>${cartCount() ? `<strong>${cartCount()}</strong>` : ""}</a>
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
      <a class="product-media" href="${escapeHtml(productDetailHref(product))}" aria-label="View ${escapeHtml(product.name)}">
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
      <a class="market-product-media" href="${escapeHtml(productDetailHref(product))}" aria-label="View ${escapeHtml(product.name)}">
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
    ["zaki: India's Ultimate One-Stop Online Shopping Destination", "Browse mobiles, fashion, appliances, beauty, grocery, furniture and daily essentials from one responsive storefront."],
    ["What Can You Buy from zaki?", "Shop latest gadgets, apparel, footwear, home decor, cookware, personal care, toys, books and more across curated category rails."],
    ["How does this clone behave?", "The page mirrors the public storefront layout for desktop and mobile views while keeping the existing cart and account links wired to this demo app."],
    ["Are these real zaki assets?", "This local front end recreates the layout and visual rhythm with replacement imagery and demo content instead of copying private production assets."]
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
      <a class="categories-icon-button" href="/" data-action="app-back" data-fallback="/" aria-label="Go back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/><path d="M9 12h11"/></svg>
      </a>
      <h1>All Categories</h1>
      <div class="categories-top-actions">
        <button class="categories-icon-button" type="button" aria-label="Search categories">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        </button>
        <a class="categories-icon-button" href="/cart/" aria-label="Open cart">
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
              <a class="category-view-all" href="/#featured-products" aria-label="View all launches">
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
            <h2>More on zaki</h2>
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

function renderCloneBackBar(title, fallback = defaultBackFallback()) {
  return `
    <header class="clone-topbar">
      <a class="clone-back-button" href="${escapeHtml(fallback)}" data-action="app-back" data-fallback="${escapeHtml(fallback)}" aria-label="Go back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
      </a>
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function renderAccountIcon(icon) {
  const icons = {
    plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14 9l5.6 2-5.6 2-2 5.5-2-5.5-5.6-2L10 9z"/><path d="M19 4v4M17 6h4"/></svg>`,
    devices: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M10 6h4M11 18h2"/></svg>`,
    user: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2z"/><path d="M5 20.4c.7-3.8 3.3-5.8 7-5.8s6.3 2 7 5.8"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h13.5A1.5 1.5 0 0 1 20 9v9.5H5A2 2 0 0 1 3 16.5v-7A2 2 0 0 1 5 7.5z"/><path d="M5 7.5 16 4.8a1.5 1.5 0 0 1 1.8 1.1l.4 1.6"/><path d="M16.2 13h3.8v3h-3.8a1.5 1.5 0 0 1 0-3z"/></svg>`,
    location: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>`,
    privacy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 18 6v5.2c0 4-2.4 7.4-6 9.3-3.6-1.9-6-5.3-6-9.3V6z"/><path d="M9.5 12.2 11.3 14l3.4-4"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h4.2L19 9.2 14.8 5 5 14.8z"/><path d="m13.6 6.2 4.2 4.2"/><path d="M4 21h16"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>`,
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

function renderAccountListRow([icon, title, subtitle, href = `/login/?next=${encodeURIComponent("/account/")}`]) {
  return `
    <a class="account-list-row" href="${escapeHtml(href)}">
      <span class="account-row-icon">${renderAccountIcon(icon)}</span>
      <span>
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      </span>
      <svg class="account-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </a>
  `;
}

function currentUserName() {
  const metadata = state.session?.user?.user_metadata || {};
  if (metadata.full_name || metadata.name) {
    return metadata.full_name || metadata.name;
  }
  const email = currentUserEmail();
  if (!email) {
    return "Amal Babu";
  }
  const localPart = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  if (!localPart || localPart.toLowerCase().includes("amalbabu")) {
    return "Amal Babu";
  }
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderSignedAccountTile(icon, label, href) {
  return `
    <a class="signed-account-tile" href="${href}">
      <span class="account-row-icon">${renderAccountIcon(icon)}</span>
      <strong>${escapeHtml(label)}</strong>
    </a>
  `;
}

function renderSignedAccountRow([icon, title, subtitle, href = "/account/"]) {
  return `
    <a class="account-list-row" href="${href}">
      <span class="account-row-icon">${renderAccountIcon(icon)}</span>
      <span>
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      </span>
      <svg class="account-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </a>
  `;
}

function renderRecentlyViewedStore([title, image]) {
  return `
    <a class="recent-store-card" href="/categories/">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
    </a>
  `;
}

function formatDeviceDate(value) {
  if (!value) {
    return "Unknown";
  }
  return formatDate(value);
}

function isCurrentDevice(device) {
  return device.deviceId === currentDeviceId();
}

function renderDeviceCard(device) {
  const current = isCurrentDevice(device);
  return `
    <article class="device-card ${current ? "current" : ""}">
      <span class="device-card-icon">${renderAccountIcon("devices")}</span>
      <div>
        <h3>${escapeHtml(device.deviceName)}</h3>
        <p>${escapeHtml(device.deviceType)} / ${escapeHtml(device.browserName)} / ${escapeHtml(device.osName)}</p>
        <small>Last active ${escapeHtml(formatDeviceDate(device.lastSeenAt))}</small>
      </div>
      ${current ? `<strong>Current</strong>` : ""}
    </article>
  `;
}

function renderDevicesPage() {
  const devices = state.devices;
  return `
    <main class="clone-page account-page devices-page">
      ${renderCloneBackBar("Manage Devices")}
      ${renderMessage()}

      <section class="account-section device-summary-section">
        <h2>Logged-in devices</h2>
        <p>These are the browsers and devices currently saved as active for ${escapeHtml(currentUserEmail())}.</p>
      </section>

      <section class="account-section device-list-section" aria-label="Logged-in devices">
        ${state.loading.devices ? `<div class="device-loading">Loading devices...</div>` : ""}
        ${!state.loading.devices && devices.length ? devices.map(renderDeviceCard).join("") : ""}
        ${!state.loading.devices && !devices.length ? `
          <div class="device-empty-state">
            <span>${renderAccountIcon("devices")}</span>
            <strong>No devices found</strong>
            <p>Run the device table SQL in Supabase, then sign in again from each device.</p>
          </div>
        ` : ""}
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderSignedInAccountPage() {
  const signedAccountSettingsRows = [
    ["plus", "zaki Plus", ""],
    ["devices", "Manage Devices", "", "/account/devices/"],
    ["user", "Edit Profile", ""],
    ["location", "Saved Addresses", ""],
    ["language", "Select Language", ""],
    ["bell", "Notification Settings", ""],
    ["privacy", "Privacy Center", ""]
  ];
  const signedActivityRows = [
    ["edit", "Reviews", ""],
    ["chat", "Questions & Answers", ""]
  ];
  const recentlyViewedStores = [
    ["Bike store", "https://images.unsplash.com/photo-1558981852-426c6c22a060?auto=format&fit=crop&w=260&q=80"],
    ["Car accessories", "https://images.unsplash.com/photo-1549927681-0b673b8243ab?auto=format&fit=crop&w=260&q=80"],
    ["Home essentials", "https://images.unsplash.com/photo-1531884070720-875c7622d4c6?auto=format&fit=crop&w=260&q=80"],
    ["Furniture", "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=260&q=80"]
  ];
  return `
    <main class="clone-page account-page signed-account-page">
      <section class="signed-profile-card">
        <div>
          <h1>${escapeHtml(currentUserName())}</h1>
          <p>Enjoy FREE YouTube Premium, Early Access to sale and more with Black.</p>
          <a href="/account/">Explore BLACK</a>
        </div>
        <span class="supercoin-pill">0</span>
      </section>

      <section class="signed-account-grid" aria-label="Account shortcuts">
        ${renderSignedAccountTile("shop", "Orders", "/user/orders/")}
        ${renderSignedAccountTile("help", "Wishlist", "/categories/")}
        ${renderSignedAccountTile("document", "Coupons", "/categories/")}
        ${renderSignedAccountTile("bell", "Help Center", "/account/")}
      </section>

      <section class="account-section recent-stores-section">
        <h2>Recently Viewed Stores</h2>
        <div class="recent-store-strip">
          ${recentlyViewedStores.map(renderRecentlyViewedStore).join("")}
        </div>
      </section>

      <section class="account-section signed-settings-section">
        <h2>Account Settings</h2>
        ${signedAccountSettingsRows.map(renderSignedAccountRow).join("")}
      </section>

      <section class="account-section signed-settings-section">
        <h2>My Activity</h2>
        ${signedActivityRows.map(renderSignedAccountRow).join("")}
      </section>

      <section class="account-section signed-settings-section">
        <h2>Earn with zaki</h2>
        ${renderSignedAccountRow(["shop", "Sell on zaki", "Register or open your seller store", "/seller/register/"])}
      </section>

      <section class="account-section signed-settings-section">
        <h2>Feedback & Information</h2>
        ${accountInfoRows.map(renderSignedAccountRow).join("")}
      </section>

      <section class="signed-logout-section" aria-label="Account sign out">
        <button class="signed-logout-button" type="button" data-action="sign-out">Log Out</button>
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderAccountPage() {
  if (isSignedIn()) {
    return renderSignedInAccountPage();
  }

  return `
    <main class="clone-page account-page">
      ${renderCloneBackBar("Account")}

      <section class="account-login-strip">
        <span>Log in to get exclusive offers</span>
        <a href="/login/?next=${encodeURIComponent("/account/")}">Log In</a>
      </section>

      <section class="account-section language-section">
        <h2>Try zaki in your language</h2>
        <div class="language-chip-row" aria-label="Language options">
          <a href="/login/">हिंदी</a>
          <a href="/login/">தமிழ்</a>
          <a href="/login/">తెలుగు</a>
          <a href="/login/">ಕನ್ನಡ</a>
          <a class="more" href="/login/">+8 more</a>
        </div>
      </section>

      <section class="account-section">
        <h2>Account Settings</h2>
        ${accountSettingsRows.map(renderAccountListRow).join("")}
      </section>

      <section class="account-section">
        <h2>Earn with zaki</h2>
        ${renderAccountListRow(["shop", "Sell on zaki", "", `/login/?next=${encodeURIComponent("/seller/register/")}`])}
      </section>

      <section class="account-section">
        <h2>Feedback & Information</h2>
        ${accountInfoRows.map(renderAccountListRow).join("")}
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function sellerStatusLabel(status = "pending") {
  const labels = {
    pending: "Pending approval",
    approved: "Approved",
    active: "Active",
    rejected: "Needs changes"
  };
  return labels[status] || "Pending approval";
}

function sellerStatusText(status = "pending") {
  if (status === "active" || status === "approved") {
    return "Your store is ready for catalog setup and order management.";
  }
  if (status === "rejected") {
    return "Review your details and contact support before resubmitting.";
  }
  return "Your seller application is under review. This usually takes 24 to 48 hours.";
}

function renderSellerBottomNav(active) {
  const item = (href, icon, label, key) => `
    <a class="seller-nav-link ${active === key ? "active" : ""}" href="${href}">
      <span>${renderAccountIcon(icon)}</span>
      <strong>${escapeHtml(label)}</strong>
    </a>
  `;
  return `
    <nav class="seller-bottom-nav" aria-label="Seller navigation">
      ${item("/seller/", "shop", "Home", "home")}
      ${item("/seller/products/", "document", "Products", "products")}
      ${item("/seller/orders/", "chat", "Orders", "orders")}
      ${item("/seller/account/", "user", "Account", "account")}
    </nav>
  `;
}

function renderSellerEmpty(title, copy, actionHref = "/seller/register/", actionLabel = "Register as seller") {
  return `
    <main class="clone-page seller-page">
      ${renderCloneBackBar("Seller Hub", "/account/")}
      ${renderMessage()}
      <section class="seller-empty">
        <span>${renderAccountIcon("shop")}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(copy)}</p>
        <a href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
      </section>
    </main>
  `;
}

function renderSellerRegisterPage() {
  if (state.loading.seller) {
    return renderBoot();
  }
  if (state.seller) {
    return renderSellerEmpty("Seller profile already exists", "Open your seller home to manage this store.", "/seller/", "Open seller home");
  }

  return `
    <main class="clone-page seller-page seller-register-page">
      ${renderCloneBackBar("Seller Registration", "/account/")}
      ${renderMessage()}

      <section class="seller-intro">
        <div>
          <span>${renderAccountIcon("shop")}</span>
          <h1>Start selling on zaki</h1>
          <p>Complete these business details so your seller profile can be verified.</p>
        </div>
        <ol>
          <li>Submit seller details</li>
          <li>Verification in 24 to 48 hours</li>
          <li>Prepare products from seller home</li>
        </ol>
      </section>

      <form class="seller-form" data-form="seller-registration">
        <label>Store name
          <input name="storeName" data-focus-key="seller-store-name" autocomplete="organization" placeholder="Example: Babu Traders" required>
        </label>

        <fieldset class="seller-choice-field">
          <legend>Business type</legend>
          <label><input type="radio" name="businessType" value="individual" required> Individual</label>
          <label><input type="radio" name="businessType" value="business"> Registered business</label>
        </fieldset>

        <label>Primary category
          <select name="category" data-focus-key="seller-category" required>
            <option value="">Select category</option>
            ${sellerCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>

        <div class="seller-form-grid">
          <label>Contact phone
            <input name="contactPhone" data-focus-key="seller-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10 digit mobile number" required>
          </label>
          <label>Pickup pincode
            <input name="pickupPincode" data-focus-key="seller-pincode" inputmode="numeric" autocomplete="postal-code" placeholder="6 digit pincode" required>
          </label>
        </div>

        <label>Pickup city
          <input name="pickupCity" data-focus-key="seller-city" autocomplete="address-level2" placeholder="City for pickup operations" required>
        </label>

        <label>GST number <small>Optional</small>
          <input name="gstNumber" data-focus-key="seller-gst" maxlength="15" placeholder="15 character GSTIN">
        </label>

        <label>Business description <small>Optional</small>
          <textarea name="description" data-focus-key="seller-description" rows="4" placeholder="What do you sell and where do you source products from?"></textarea>
        </label>

        <label class="seller-terms">
          <input type="checkbox" name="agreeTerms" required>
          <span>I confirm these details are correct and agree to seller verification before listing products.</span>
        </label>

        <button type="submit" ${state.loading.action === "seller-registration" ? "disabled" : ""}>
          ${state.loading.action === "seller-registration" ? "Submitting..." : "Submit seller application"}
        </button>
      </form>
    </main>
  `;
}

function renderSellerHomePage() {
  if (state.loading.seller) {
    return renderBoot();
  }
  if (!state.seller) {
    return renderSellerEmpty("Register to sell on zaki", "Create a seller profile before opening the seller home.");
  }

  const seller = state.seller;
  return `
    <main class="clone-page seller-page seller-home-page">
      ${renderCloneBackBar("Seller Home", "/account/")}
      ${renderMessage()}

      <section class="seller-hero-card">
        <div>
          <span class="seller-status ${escapeHtml(seller.status)}">${escapeHtml(sellerStatusLabel(seller.status))}</span>
          <h1>${escapeHtml(seller.storeName)}</h1>
          <p>${escapeHtml(seller.category)} store by ${escapeHtml(seller.businessType === "business" ? "Registered business" : "Individual seller")}</p>
        </div>
        <strong>${escapeHtml(String(Math.max(0, seller.rating || 0).toFixed(1)))}</strong>
      </section>

      <section class="seller-review-card">
        <h2>Verification status</h2>
        <p>${escapeHtml(sellerStatusText(seller.status))}</p>
        <dl>
          <div><dt>Pickup city</dt><dd>${escapeHtml(seller.pickupCity || "Not set")}</dd></div>
          <div><dt>Pickup pincode</dt><dd>${escapeHtml(seller.pickupPincode || "Not set")}</dd></div>
          <div><dt>Contact</dt><dd>${escapeHtml(seller.contactPhone || currentUserEmail())}</dd></div>
        </dl>
      </section>

      <section class="seller-metrics" aria-label="Seller performance">
        <div><strong>${escapeHtml(seller.totalProducts)}</strong><span>Products</span></div>
        <div><strong>${escapeHtml(seller.totalOrders)}</strong><span>Orders</span></div>
        <div><strong>${escapeHtml(moneyFormatter.format(seller.totalRevenue))}</strong><span>Revenue</span></div>
      </section>

      <section class="seller-actions">
        <a href="/seller/products/">${renderAccountIcon("document")}<span><strong>Manage products</strong><small>Add and review product listings</small></span></a>
        <a href="/seller/orders/">${renderAccountIcon("chat")}<span><strong>Seller orders</strong><small>Track customer orders</small></span></a>
        <a href="/seller/account/">${renderAccountIcon("user")}<span><strong>Seller account</strong><small>Manage store and login details</small></span></a>
      </section>
    </main>
    ${renderSellerBottomNav("home")}
  `;
}

function sellerProductStatusLabel(status = "draft") {
  if (status === "active") {
    return "Live";
  }
  if (status === "paused") {
    return "Paused";
  }
  return "Draft";
}

function renderSellerProductForm() {
  return `
    <form class="seller-form seller-product-form" data-form="seller-product">
      <label>Product name
        <input name="name" data-focus-key="seller-product-name" autocomplete="off" placeholder="Example: Disposable shoe wipes" required>
      </label>

      <div class="seller-form-grid">
        <label>Category
          <select name="category" data-focus-key="seller-product-category" required>
            <option value="">Select category</option>
            ${sellerCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
        <label>Status
          <select name="status" data-focus-key="seller-product-status">
            <option value="active">Live</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
          </select>
        </label>
      </div>

      <div class="seller-form-grid">
        <label>Selling price
          <input name="price" data-focus-key="seller-product-price" type="number" min="1" step="0.01" inputmode="decimal" placeholder="138" required>
        </label>
        <label>Stock quantity
          <input name="stock" data-focus-key="seller-product-stock" type="number" min="0" step="1" inputmode="numeric" placeholder="25" required>
        </label>
      </div>

      <label>Product image URL <small>Optional</small>
        <input name="imageUrl" data-focus-key="seller-product-image" type="url" placeholder="https://example.com/product.jpg">
      </label>

      <label>Description <small>Optional</small>
        <textarea name="description" data-focus-key="seller-product-description" rows="4" placeholder="Short product details customers should know."></textarea>
      </label>

      <button type="submit" ${state.loading.action === "seller-product" ? "disabled" : ""}>
        ${state.loading.action === "seller-product" ? "Adding..." : "Add product"}
      </button>
    </form>
  `;
}

function renderSellerProductCard(product) {
  const status = product.status || "draft";
  const productInitial = (product.name || "P").trim().charAt(0).toUpperCase();
  const statusLoading = state.loading.action === `seller-product-status:${product.id}`;
  const statusButtonAttrs = `data-action="seller-product-status" data-product-id="${escapeHtml(product.id)}" ${statusLoading ? "disabled" : ""}`;
  const statusAction = status === "active"
    ? `<button type="button" ${statusButtonAttrs} data-status="paused">${statusLoading ? "Updating..." : "Pause"}</button>`
    : `<button type="button" ${statusButtonAttrs} data-status="active">${statusLoading ? "Updating..." : "Make live"}</button>`;
  return `
    <article class="seller-product-card">
      <div class="seller-product-media">
        ${product.imageUrl
          ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
          : `<span aria-hidden="true">${escapeHtml(productInitial)}</span>`}
      </div>
      <div class="seller-product-copy">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span class="seller-product-status ${escapeHtml(status)}">${escapeHtml(sellerProductStatusLabel(status))}</span>
        </div>
        <p>${escapeHtml(product.description || product.category)}</p>
        <dl>
          <div><dt>Price</dt><dd>${formatMoney(product.pricePaise)}</dd></div>
          <div><dt>Stock</dt><dd>${escapeHtml(product.stock)}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(product.category)}</dd></div>
        </dl>
        <div class="seller-product-card-actions">
          ${statusAction}
        </div>
      </div>
    </article>
  `;
}

function renderSellerProductList() {
  if (state.loading.sellerProducts) {
    return `
      <section class="seller-empty-list">
        <span>${renderAccountIcon("document")}</span>
        <h2>Loading products</h2>
        <p>Fetching your saved catalog.</p>
      </section>
    `;
  }

  if (!state.sellerProducts.length) {
    return `
      <section class="seller-empty-list">
        <span>${renderAccountIcon("document")}</span>
        <h2>No products listed yet</h2>
        <p>Add your first product using the form above. Draft products stay private until you mark them live.</p>
      </section>
    `;
  }

  return `
    <section class="seller-product-list" aria-labelledby="sellerProductListTitle">
      <div class="seller-product-list-heading">
        <h2 id="sellerProductListTitle">Current listings</h2>
        <p>${escapeHtml(state.sellerProducts.length)} product${state.sellerProducts.length === 1 ? "" : "s"} saved</p>
      </div>
      ${state.sellerProducts.map(renderSellerProductCard).join("")}
    </section>
  `;
}

function renderSellerProductsPage() {
  if (state.loading.seller) {
    return renderBoot();
  }
  if (!state.seller) {
    return renderSellerEmpty("Register before adding products", "Seller products are available after you create your seller profile.");
  }

  return `
    <main class="clone-page seller-page seller-products-page">
      ${renderCloneBackBar("Seller Products", "/seller/")}
      ${renderMessage()}
      <section class="seller-page-heading">
        <h1>Products</h1>
        <p>Add products for ${escapeHtml(state.seller.storeName)} and manage what appears in your catalog.</p>
      </section>
      ${renderSellerProductForm()}
      ${renderSellerProductList()}
    </main>
    ${renderSellerBottomNav("products")}
  `;
}

function renderSellerOrdersPage() {
  if (state.loading.seller) {
    return renderBoot();
  }
  if (!state.seller) {
    return renderSellerEmpty("Register before viewing seller orders", "Seller orders are available after you create your seller profile.");
  }

  return `
    <main class="clone-page seller-page seller-orders-page">
      ${renderCloneBackBar("Seller Orders", "/seller/")}
      ${renderMessage()}
      <section class="seller-page-heading">
        <h1>Orders</h1>
        <p>Customer orders for ${escapeHtml(state.seller.storeName)} will show here.</p>
      </section>
      <section class="seller-empty-list">
        <span>${renderAccountIcon("chat")}</span>
        <h2>No seller orders yet</h2>
        <p>Orders will appear once your products are live and customers start buying.</p>
        <a href="/seller/products/">View products</a>
      </section>
    </main>
    ${renderSellerBottomNav("orders")}
  `;
}

function renderSellerAccountPage() {
  if (state.loading.seller) {
    return renderBoot();
  }
  if (!state.seller) {
    return renderSellerEmpty("Register before opening seller account", "Seller account settings are available after you create your seller profile.");
  }

  const seller = state.seller;
  return `
    <main class="clone-page seller-page seller-account-page">
      ${renderCloneBackBar("Seller Account", "/seller/")}
      ${renderMessage()}

      <section class="seller-hero-card seller-account-hero">
        <div>
          <span class="seller-status ${escapeHtml(seller.status)}">${escapeHtml(sellerStatusLabel(seller.status))}</span>
          <h1>${escapeHtml(seller.storeName)}</h1>
          <p>${escapeHtml(currentUserEmail())}</p>
        </div>
        <strong>${escapeHtml((seller.storeName || "Z").charAt(0).toUpperCase())}</strong>
      </section>

      <section class="seller-review-card">
        <h2>Store profile</h2>
        <p>${escapeHtml(seller.description || "Add products and manage orders from your seller pages.")}</p>
        <dl>
          <div><dt>Business type</dt><dd>${escapeHtml(seller.businessType === "business" ? "Registered business" : "Individual seller")}</dd></div>
          <div><dt>Primary category</dt><dd>${escapeHtml(seller.category || "Not set")}</dd></div>
          <div><dt>GST number</dt><dd>${escapeHtml(seller.gstNumber || "Not provided")}</dd></div>
          <div><dt>Pickup city</dt><dd>${escapeHtml(seller.pickupCity || "Not set")}</dd></div>
          <div><dt>Pickup pincode</dt><dd>${escapeHtml(seller.pickupPincode || "Not set")}</dd></div>
          <div><dt>Contact phone</dt><dd>${escapeHtml(seller.contactPhone || "Not set")}</dd></div>
        </dl>
      </section>

      <section class="seller-actions">
        <a href="/seller/products/">${renderAccountIcon("document")}<span><strong>Products</strong><small>Add products and review your catalog</small></span></a>
        <a href="/seller/orders/">${renderAccountIcon("chat")}<span><strong>Orders</strong><small>Check customer order activity</small></span></a>
        <a href="/account/devices/">${renderAccountIcon("devices")}<span><strong>Manage devices</strong><small>View browsers where this login is active</small></span></a>
        <a href="/account/">${renderAccountIcon("user")}<span><strong>Buyer account</strong><small>Open normal shopping account settings</small></span></a>
      </section>

      <section class="seller-signout-section" aria-label="Seller sign out">
        <button type="button" data-action="sign-out">Log Out</button>
      </section>
    </main>
    ${renderSellerBottomNav("account")}
  `;
}

function renderCartEmptyGraphic() {
  return `
    <div class="cart-empty-graphic" aria-hidden="true">
      <span>z</span>
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

function cartProductForItem(item) {
  return productById(item.productId) || {
    id: item.productId,
    name: item.name,
    pricePaise: item.pricePaise,
    image: fallbackImages[0],
    alt: `${item.name} product image`,
    category: "Product",
    badge: "Early Bird Deal",
    rating: "4.0",
    delivery: "Wed Jul 8",
    channel: "zaki Assured"
  };
}

function cartItemListPricePaise(item) {
  const product = cartProductForItem(item);
  return productListPricePaise(product) * Number(item.quantity || 1);
}

function cartPriceSummary(items = state.cart) {
  const pricePaise = items.reduce((sum, item) => sum + cartItemListPricePaise(item), 0);
  const sellingPaise = cartTotalPaise(items);
  const discountPaise = Math.max(pricePaise - sellingPaise, 0);
  const couponPaise = items.length ? Math.min(1200, Math.max(0, Math.round(sellingPaise * 0.08))) : 0;
  const platformFeePaise = items.length ? 900 : 0;
  const totalPaise = Math.max(0, sellingPaise - couponPaise + platformFeePaise);
  const savedPaise = Math.max(0, pricePaise - totalPaise);
  return { pricePaise, sellingPaise, discountPaise, couponPaise, platformFeePaise, totalPaise, savedPaise };
}

function renderFilledCartItem(item, options = {}) {
  const product = cartProductForItem(item);
  const quantity = Number(item.quantity || 1);
  const unitListPrice = Math.max(productListPricePaise(product), Number(item.pricePaise || product.pricePaise || 0));
  const unitPrice = Number(item.pricePaise || product.pricePaise || 0);
  const discount = unitListPrice ? Math.max(0, Math.round(((unitListPrice - unitPrice) / unitListPrice) * 100)) : productDiscountPercent(product);
  const quantityAction = options.quantityAction || "quantity";
  const quantityButtonAttrs = (direction, label) => options.lockQuantity
    ? "disabled"
    : `data-action="${escapeHtml(quantityAction)}" data-product-id="${escapeHtml(item.productId)}" data-direction="${escapeHtml(direction)}" aria-label="${escapeHtml(label)}"`;
  return `
    <article class="filled-cart-item">
      <div class="filled-cart-badge">${escapeHtml(product.badge || "Early Bird Deal")}</div>
      <div class="filled-cart-product">
        <a class="filled-cart-media" href="${escapeHtml(productDetailHref(product))}" aria-label="View ${escapeHtml(product.name)}">
          <img src="${escapeHtml(product.image || fallbackImages[0])}" alt="${escapeHtml(product.alt || product.name)}" loading="lazy">
        </a>
        <div class="filled-cart-copy">
          <a href="${escapeHtml(productDetailHref(product))}">${escapeHtml(product.name)}</a>
          <span>${escapeHtml(product.category || "Generic")}, ${escapeHtml(product.channel || "Assured")}</span>
          <div class="filled-cart-rating">
            <b>${escapeHtml(product.rating || "4.0")}</b>
            <small>(648)</small>
            <em>Assured</em>
          </div>
          <div class="filled-cart-price">
            <strong>${discount}%</strong>
            <s>${formatMoney(unitListPrice)}</s>
            <b>${formatMoney(unitPrice)}</b>
          </div>
        </div>
      </div>
      <div class="filled-cart-meta">
        <div class="filled-cart-qty" aria-label="Quantity for ${escapeHtml(item.name)}">
          <div class="filled-cart-qty-stepper">
            <button class="filled-cart-qty-step" type="button" ${quantity <= 1 ? "disabled" : quantityButtonAttrs(-1, `Decrease quantity for ${item.name}`)}>-</button>
            <span class="filled-cart-qty-value">Qty: ${escapeHtml(quantity)}</span>
            <button class="filled-cart-qty-step" type="button" ${quantity >= 20 ? "disabled" : quantityButtonAttrs(1, `Increase quantity for ${item.name}`)}>+</button>
          </div>
        </div>
        <p>Delivery by ${escapeHtml(product.delivery || "Wed Jul 8")}</p>
      </div>
      <div class="filled-cart-actions">
        <button type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Save for later</button>
        <button type="button" data-action="quantity" data-product-id="${escapeHtml(item.productId)}" data-direction="${escapeHtml(-quantity)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"/><path d="M9 7V5h6v2"/><path d="M9 10v8M15 10v8"/><path d="M8 7l1 14h6l1-14"/></svg>Remove</button>
        <button type="button" data-action="buy-now" data-product-id="${escapeHtml(item.productId)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 4-6 9h5l-1 7 6-10h-5z"/></svg>Buy this now</button>
      </div>
    </article>
  `;
}

function renderCartAddressStrip() {
  return `
    <section class="cart-address-strip">
      <span>From Saved Addresses</span>
      <a href="/cart/summary/?edit=address">Enter Delivery Pincode</a>
    </section>
  `;
}

function renderCartSecureNote() {
  return `
    <section class="cart-secure-note" aria-label="Secure payment note">
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3.5 18 6v5.2c0 4-2.4 7.4-6 9.3-3.6-1.9-6-5.3-6-9.3V6z"/><path d="m9.5 12.2 1.8 1.8 3.4-4"/></svg>
      </span>
      <p>Safe and secure payments. Easy returns.<br>100% Authentic products.</p>
    </section>
  `;
}

function isPaymentAddressComplete(address) {
  return Boolean(address?.fullName && address?.phone && address?.address && address?.pincode && address?.city && address?.state);
}

function renderOrderSummaryProgress(address) {
  const hasAddress = isPaymentAddressComplete(address);
  return `
    <section class="checkout-progress" aria-label="Checkout progress">
      <div class="checkout-step ${hasAddress ? "complete" : ""}">
        <span>${hasAddress ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>` : "1"}</span>
        <strong>Address</strong>
      </div>
      <div class="checkout-line active"></div>
      <div class="checkout-step active">
        <span>2</span>
        <strong>Order Summary</strong>
      </div>
      <div class="checkout-line"></div>
      <div class="checkout-step">
        <span>3</span>
        <strong>Payment</strong>
      </div>
    </section>
  `;
}

function renderCartDeliveryAddress(address) {
  if (!isPaymentAddressComplete(address)) {
    return `
      <section class="order-address-card">
        <div>
          <span>Deliver to:</span>
          <strong>Add delivery address</strong>
          <p>Enter your address before continuing to payment.</p>
        </div>
        <button type="button" data-action="edit-address">Add</button>
      </section>
    `;
  }

  const addressLine = [address.address, address.city, address.state, address.pincode].filter(Boolean).join(", ");
  return `
    <section class="order-address-card">
      <div>
        <span>Deliver to:</span>
        <strong>${escapeHtml(address.fullName || currentUserName())} <em>HOME</em></strong>
        <p>${escapeHtml(addressLine)}</p>
        <p>${escapeHtml(address.phone || "")}</p>
      </div>
      <button type="button" data-action="edit-address">Change</button>
    </section>
  `;
}

function renderOrderAddressForm(address) {
  const hasAddress = isPaymentAddressComplete(address);
  return `
    <form class="payment-address-form order-address-form" data-form="payment-address">
      <div class="order-address-form-heading">
        <h2>${hasAddress ? "Change delivery address" : "Add delivery address"}</h2>
        <p>${hasAddress ? "Update the saved delivery details for this order." : "Add delivery details before continuing to payment."}</p>
      </div>
      <label>Full name
        <input name="fullName" data-focus-key="summary-payment-name" autocomplete="name" value="${escapeHtml(address.fullName || currentUserEmail().split("@")[0] || "")}" required>
      </label>
      <label>Phone number
        <input name="phone" data-focus-key="summary-payment-phone" type="tel" autocomplete="tel" value="${escapeHtml(address.phone || "")}" required>
      </label>
      <label>Address
        <textarea name="address" data-focus-key="summary-payment-address" autocomplete="street-address" required>${escapeHtml(address.address || "")}</textarea>
      </label>
      <div class="payment-form-grid">
        <label>Pincode
          <input name="pincode" data-focus-key="summary-payment-pincode" inputmode="numeric" autocomplete="postal-code" value="${escapeHtml(address.pincode || "")}" required>
        </label>
        <label>City
          <input name="city" data-focus-key="summary-payment-city" autocomplete="address-level2" value="${escapeHtml(address.city || "")}" required>
        </label>
      </div>
      <label>State
        <input name="state" data-focus-key="summary-payment-state" autocomplete="address-level1" value="${escapeHtml(address.state || "")}" required>
      </label>
      <div class="order-address-form-actions">
        ${hasAddress ? `<button class="secondary" type="button" data-action="cancel-address-edit">Cancel</button>` : ""}
        <button type="submit">Save Address</button>
      </div>
    </form>
  `;
}

function renderOrderSummaryPage() {
  const items = checkoutItems();
  const summary = cartPriceSummary(items);
  const address = savedPaymentAddress();
  const showAddressForm = state.paymentAddressEdit || !isPaymentAddressComplete(address);
  if (!items.length) {
    return `
      <main class="clone-page public-cart-page order-summary-page">
        ${renderCloneBackBar("Order Summary")}
        <section class="payment-empty">
          <h1>No item selected</h1>
          <p>Add a product before reviewing your order.</p>
          <a href="/">Continue shopping</a>
        </section>
      </main>
    `;
  }

  return `
    <main class="clone-page public-cart-page order-summary-page">
      ${renderCloneBackBar("Order Summary")}
      ${renderOrderSummaryProgress(address)}
      ${renderMessage()}
      ${showAddressForm ? renderOrderAddressForm(address) : renderCartDeliveryAddress(address)}

      <section class="filled-cart-list" aria-label="Order items">
        ${items.map((item) => renderFilledCartItem(item, { quantityAction: isBuyNowCheckout() ? "buy-now-quantity" : "quantity" })).join("")}
      </section>

      <section class="cart-price-card" aria-labelledby="summaryPriceDetailsTitle">
        <h2 id="summaryPriceDetailsTitle">Price Details</h2>
        <div class="cart-price-lines">
          <div><span>MRP (incl. of all taxes)</span><strong>${formatMoney(summary.pricePaise)}</strong></div>
          <div><span>Fees</span><strong>${formatMoney(summary.platformFeePaise)}</strong></div>
          <div><span>Discounts</span><strong class="saving">${formatMoney(summary.discountPaise + summary.couponPaise)}</strong></div>
        </div>
        <div class="cart-price-total">
          <span>Total Amount</span>
          <strong>${formatMoney(summary.totalPaise)}</strong>
        </div>
        <p class="cart-save-note">You'll save ${formatMoney(summary.savedPaise)} on this order!</p>
      </section>

      <div class="cart-order-bar summary-order-bar">
        <div>
          <s>${formatMoney(summary.pricePaise)}</s>
          <strong>${formatMoney(summary.totalPaise)}</strong>
        </div>
        <button type="button" data-action="continue-payment" ${state.loading.action === "payment" ? "disabled" : ""}>Continue</button>
      </div>
    </main>
  `;
}

function renderFilledCartPage() {
  const summary = cartPriceSummary();
  return `
    <main class="clone-page public-cart-page filled-cart-page">
      ${renderCloneBackBar("My Cart")}
      ${renderCartAddressStrip()}
      ${renderMessage()}

      <section class="filled-cart-list" aria-label="Cart items">
        ${state.cart.map(renderFilledCartItem).join("")}
      </section>

      <section class="cart-price-card" aria-labelledby="priceDetailsTitle">
        <h2 id="priceDetailsTitle">Price Details</h2>
        <div class="cart-price-lines">
          <div><span>MRP (incl. of all taxes)</span><strong>${formatMoney(summary.pricePaise)}</strong></div>
          <div><span>Fees</span><strong>${formatMoney(summary.platformFeePaise)}</strong></div>
          <div><span>Discounts</span><strong class="saving">${formatMoney(summary.discountPaise + summary.couponPaise)}</strong></div>
        </div>
        <div class="cart-price-total">
          <span>Total Amount</span>
          <strong>${formatMoney(summary.totalPaise)}</strong>
        </div>
        <p class="cart-save-note">You'll save ${formatMoney(summary.savedPaise)} on this order!</p>
      </section>

      ${renderCartSecureNote()}

      <div class="cart-order-bar">
        <div>
          <s>${formatMoney(summary.pricePaise)}</s>
          <strong>${formatMoney(summary.totalPaise)}</strong>
        </div>
        <button type="button" data-action="go-payment">Place Order</button>
      </div>
    </main>
    ${renderBottomNav()}
  `;
}

function parseStoredAddress(value) {
  if (!value) {
    return {};
  }

  try {
    const address = JSON.parse(value);
    return address && typeof address === "object" ? address : {};
  } catch {
    return {};
  }
}

function savePaymentAddress(address) {
  const normalized = normalizePaymentAddress(address);
  try {
    localStorage.setItem(deliveryAddressStorageKey(), JSON.stringify(normalized));
    sessionStorage.removeItem(deliveryAddressLegacyKey);
  } catch {
    try {
      sessionStorage.setItem(deliveryAddressLegacyKey, JSON.stringify(normalized));
    } catch {
      // Storage can be unavailable in stricter browser modes; checkout can still continue.
    }
  }
}

function localPaymentAddress() {
  const storageKey = deliveryAddressStorageKey();

  try {
    const savedAddress = normalizePaymentAddress(parseStoredAddress(localStorage.getItem(storageKey)));
    if (hasPaymentAddressValue(savedAddress)) {
      return savedAddress;
    }
  } catch {
    // Fall through to the legacy session value.
  }

  try {
    const legacyAddress = normalizePaymentAddress(parseStoredAddress(sessionStorage.getItem(deliveryAddressLegacyKey)));
    if (hasPaymentAddressValue(legacyAddress)) {
      savePaymentAddress(legacyAddress);
      return legacyAddress;
    }
  } catch {
    // Ignore unavailable session storage.
  }

  return {};
}

function savedPaymentAddress() {
  const loadedAddress = normalizePaymentAddress(state.deliveryAddress || {});
  if (isPaymentAddressComplete(loadedAddress)) {
    return loadedAddress;
  }
  return localPaymentAddress();
}

function renderPaymentSummaryItem(item) {
  const product = cartProductForItem(item);
  return `
    <article class="payment-summary-item">
      <img src="${escapeHtml(product.image || fallbackImages[0])}" alt="${escapeHtml(product.alt || product.name)}" loading="lazy">
      <div>
        <strong>${escapeHtml(item.name || product.name)}</strong>
        <span>Qty ${escapeHtml(item.quantity || 1)} | ${escapeHtml(product.channel || "zaki Assured")}</span>
      </div>
      <b>${formatMoney(item.lineTotalPaise || item.pricePaise)}</b>
    </article>
  `;
}

function renderPaymentPage() {
  const summary = cartPriceSummary();
  const address = savedPaymentAddress();
  const paymentActionLabel = state.paymentAddressEdit ? "Save Address" : "Continue to Razorpay";

  if (!state.cart.length) {
    return `
      <main class="payment-page">
        ${renderCloneBackBar("Payment")}
        <section class="payment-empty">
          <h1>No item selected</h1>
          <p>Add a product with Buy now before continuing to payment.</p>
          <a href="/">Continue shopping</a>
        </section>
      </main>
    `;
  }

  return `
    <main class="payment-page">
      ${renderCloneBackBar("Payment")}
      <section class="payment-step-card">
        <span>1</span>
        <div>
          <h1>Delivery address</h1>
          <p>Enter the address where this order should be delivered.</p>
        </div>
      </section>

      ${renderMessage()}

      <form class="payment-address-form" data-form="payment-address">
        <label>Full name
          <input name="fullName" data-focus-key="payment-name" autocomplete="name" value="${escapeHtml(address.fullName || currentUserEmail().split("@")[0] || "")}" required>
        </label>
        <label>Phone number
          <input name="phone" data-focus-key="payment-phone" type="tel" autocomplete="tel" value="${escapeHtml(address.phone || "")}" required>
        </label>
        <label>Address
          <textarea name="address" data-focus-key="payment-address" autocomplete="street-address" required>${escapeHtml(address.address || "")}</textarea>
        </label>
        <div class="payment-form-grid">
          <label>Pincode
            <input name="pincode" data-focus-key="payment-pincode" inputmode="numeric" autocomplete="postal-code" value="${escapeHtml(address.pincode || "")}" required>
          </label>
          <label>City
            <input name="city" data-focus-key="payment-city" autocomplete="address-level2" value="${escapeHtml(address.city || "")}" required>
          </label>
        </div>
        <label>State
          <input name="state" data-focus-key="payment-state" autocomplete="address-level1" value="${escapeHtml(address.state || "")}" required>
        </label>

        <section class="payment-summary-card" aria-labelledby="paymentSummaryTitle">
          <div class="payment-summary-heading">
            <span>2</span>
            <div>
              <h2 id="paymentSummaryTitle">Order summary</h2>
              <p>${cartCount()} item${cartCount() === 1 ? "" : "s"} ready for payment</p>
            </div>
          </div>
          <div class="payment-summary-list">
            ${state.cart.map(renderPaymentSummaryItem).join("")}
          </div>
          <div class="payment-total-row"><span>Total payable</span><strong>${formatMoney(summary.totalPaise)}</strong></div>
        </section>

        <section class="payment-razorpay-card">
          <span aria-hidden="true">R</span>
          <div>
            <h2>Razorpay Secure Checkout</h2>
            <p>Continue to Razorpay to complete this payment.</p>
          </div>
        </section>

        <div class="payment-action-bar">
          <div>
            <small>Total</small>
            <strong>${formatMoney(summary.totalPaise)}</strong>
          </div>
          <button type="submit" ${state.loading.action === "payment" ? "disabled" : ""}>${paymentActionLabel}</button>
        </div>
      </form>
    </main>
  `;
}

function renderPublicCartPage() {
  if (state.cart.length) {
    return renderFilledCartPage();
  }

  return `
    <main class="clone-page public-cart-page">
      ${renderCloneBackBar("My Cart")}

      <section class="cart-empty-panel">
        ${renderCartEmptyGraphic()}
        <h2>Missing Cart items?</h2>
        ${isSignedIn() ? "" : `<a class="cart-login-button" href="/login/?next=${encodeURIComponent("/cart/")}">Login</a>`}
        <a class="cart-continue-link" href="/">Continue Shopping</a>
      </section>

      <section class="cart-suggestion-section">
        <h2>Suggested for You</h2>
        <p>Based on Your Activity</p>
        <article class="cart-suggestion-card">
          <img src="${escapeHtml(cartSuggestionProduct.image)}" alt="${escapeHtml(cartSuggestionProduct.title)}" loading="lazy">
          <strong>${escapeHtml(cartSuggestionProduct.title)}</strong>
          <span>${escapeHtml(cartSuggestionProduct.price)}</span>
          <small><b></b>Assured</small>
          <a href="/login/?next=${encodeURIComponent("/cart/")}">Add to cart</a>
        </article>
      </section>

      <section class="cart-recent-section">
        <h2>Recently Viewed</h2>
      </section>
    </main>
    ${renderBottomNav()}
  `;
}

function renderProductTopbar() {
  return `
    <header class="product-topbar">
      <a class="product-back" href="/" data-action="app-back" data-fallback="/" aria-label="Go back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
      </a>
      <label class="product-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input data-filter="query" data-focus-key="product-search" type="search" value="${escapeHtml(state.filters.query)}" placeholder="Search for products">
      </label>
      <a class="product-cart-link" href="/cart/" aria-label="Open cart">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 5h2l1.6 10.3h10.7L20 8H7.1"/><circle cx="9" cy="20" r="1.4"/><circle cx="17.4" cy="20" r="1.4"/></svg>
        ${cartCount() ? `<strong>${cartCount()}</strong>` : ""}
      </a>
    </header>
  `;
}

function renderProductPrice(product) {
  return `
    <div class="product-detail-price">
      <span>${productDiscountPercent(product)}%</span>
      <s>${formatMoney(productListPricePaise(product))}</s>
      <strong>${formatMoney(product.pricePaise)}</strong>
    </div>
  `;
}

function renderProductDelivery(product) {
  return `
    <section class="product-panel product-delivery">
      <h2>Delivery details</h2>
      <div class="delivery-stack">
        <a class="delivery-row location" href="/account/">
          <span class="delivery-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg></span>
          <strong>Location not set</strong>
          <b>Select delivery location</b>
        </a>
        <div class="delivery-row">
          <span class="delivery-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10v9H4z"/><path d="M14 10h3.5l2.5 3v3h-6z"/><circle cx="8" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></svg></span>
          <div>
            <strong>Delivery by 8 Jul, Wed</strong>
            <small>Order in 0h 33m 14s</small>
          </div>
        </div>
        <div class="delivery-row">
          <span class="delivery-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v10H4z"/><path d="M7 8V6h10v2"/><path d="M8 12h8"/></svg></span>
          <div>
            <strong>Fulfilled by zaki Global</strong>
            <small>4.4 star | 5 months with zaki</small>
            <a href="/categories/">See other sellers</a>
          </div>
        </div>
      </div>
      <div class="product-trust-row">
        <span><b><svg viewBox="0 0 24 24"><path d="m8 8 8 8M16 8l-8 8"/><circle cx="12" cy="12" r="8"/></svg></b>No<br>returns</span>
        <span><b><svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"/><path d="M8 11h8M8 14h5"/></svg></b>Cash on<br>Delivery</span>
        <span><b><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.3 2.8 7.8 7 10 4.2-2.2 7-5.7 7-10V6z"/><path d="m9 12 2 2 4-5"/></svg></b>zaki<br>Assured</span>
      </div>
    </section>
  `;
}

function renderProductMiniCard(product, index = 0) {
  return `
    <a class="product-mini-card" href="${escapeHtml(productDetailHref(product))}">
      <span class="product-ad">AD</span>
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
      <span class="mini-rating">${escapeHtml(product.rating)} star</span>
      <strong>${escapeHtml(product.name)}</strong>
      <b>${productDiscountPercent(product)}% OFF</b>
      <small><s>${formatMoney(productListPricePaise(product))}</s> ${formatMoney(product.pricePaise)}</small>
      <em>${index % 2 ? "Hot Deal" : `Get it by ${escapeHtml(product.delivery || "7 Jul")}`}</em>
    </a>
  `;
}

function renderProductRail(title, products) {
  return `
    <section class="product-panel product-rail-section">
      <div class="product-section-heading">
        <h2>${escapeHtml(title)}</h2>
        <a href="/categories/" aria-label="View more ${escapeHtml(title)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </a>
      </div>
      <div class="product-mini-rail">
        ${products.map(renderProductMiniCard).join("")}
      </div>
    </section>
  `;
}

function renderProductHighlights(product) {
  const rows = [
    ["Number of Contents in Sales Package", "Pack of 1"],
    ["Color", product.badge || "Multicolor"],
    ["Net Quantity", "1"],
    ["Brand", "zaki"],
    ["Brand Color", String(product.category || "Multicolor").toUpperCase()],
    ["Model Name", product.name],
    ["Quantity", "1 ml"],
    ["Suitable For", "Leather, Nylon, Synthetic Leather, Sports Shoes"]
  ];
  return `
    <details class="product-accordion" open>
      <summary>Product highlights</summary>
      <div class="product-highlight-grid">
        ${rows.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderProductBoughtTogether(product, bundleProduct) {
  return `
    <details class="product-accordion product-bundle" open>
      <summary>Frequently Bought Together</summary>
      <article>
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
        <div>
          <small>TRIBRAM + This product</small>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${productDiscountPercent(product)}% ${formatMoney(product.pricePaise)}</span>
        </div>
        <b aria-hidden="true"></b>
      </article>
      ${bundleProduct ? `
        <article>
          <img src="${escapeHtml(bundleProduct.image)}" alt="${escapeHtml(bundleProduct.alt)}" loading="lazy">
          <div>
            <small>WIPSOR</small>
            <strong>${escapeHtml(bundleProduct.name)}</strong>
            <span>${formatMoney(bundleProduct.pricePaise)}</span>
          </div>
          <i aria-hidden="true"></i>
        </article>
      ` : ""}
      <button type="button" disabled>Add 1 item to cart</button>
    </details>
  `;
}

function renderProductPage() {
  const product = currentProduct();
  const recommendations = product ? relatedProducts(product, 8) : [];
  const recentlyViewed = catalogProducts().filter((item) => item.id !== product?.id).slice().reverse().slice(0, 4);
  const exploreProducts = [...recommendations].reverse().slice(0, 4);

  if (!product) {
    return `
      <main class="product-page">
        ${renderProductTopbar()}
        <section class="product-empty">
          <h1>Product not found</h1>
          <a class="btn primary" href="/">Continue shopping</a>
        </section>
      </main>
    `;
  }

  return `
    <main class="product-page">
      ${renderProductTopbar()}
      <section class="product-hero-panel">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
        <div>
          <span>${escapeHtml(product.channel || "zaki Assured")}</span>
          <h1>${escapeHtml(product.name)}</h1>
          <p>${escapeHtml(product.description || `${product.category} essentials with fast delivery`)}</p>
          ${renderProductPrice(product)}
        </div>
      </section>
      ${renderProductDelivery(product)}
      ${renderProductRail("Similar Products", recommendations)}
      ${renderProductHighlights(product)}
      <details class="product-accordion">
        <summary>All details</summary>
        <p>Features, description and more for ${escapeHtml(product.name)}. SKU ${escapeHtml(product.sku)} ships through zaki marketplace fulfillment.</p>
      </details>
      <details class="product-accordion" open>
        <summary>Ratings and reviews</summary>
        <div class="product-rating-block"><strong>${escapeHtml(product.rating)} star</strong><span>Very Good</span><small>based on 7 ratings by Verified Buyers</small></div>
      </details>
      <details class="product-accordion">
        <summary>Questions and Answers</summary>
        <p>No questions and answers available</p>
      </details>
      ${renderProductBoughtTogether(product, recommendations[0])}
      ${recentlyViewed.length ? renderProductRail("Recently Viewed", recentlyViewed) : ""}
      <section class="product-panel explore-section">
        <h2>Explore more like this</h2>
        <div class="explore-chips"><span>Early Bird Deals</span><span>Top Rated</span></div>
        <div class="product-mini-rail">${exploreProducts.map(renderProductMiniCard).join("")}</div>
      </section>
      <div class="product-action-bar">
        <button class="product-add-action" type="button" data-action="add-to-cart" data-product-id="${escapeHtml(product.id)}" ${state.loading.action === product.id ? "disabled" : ""}>Add to cart</button>
        <button class="product-buy-action" type="button" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">Buy now</button>
      </div>
    </main>
  `;
}

function renderHomePage() {
  const products = visibleProducts().slice(0, 8);
  return `
    ${renderHeader()}
    ${renderCategoryStrip()}
    <main class="home-layout market-home zaki-shell">
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
          <h2>Products for you</h2>
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

      <section class="mobile-product-heading" aria-label="Products for you">
        <h2>Products for you</h2>
        <a href="/categories/">View all</a>
      </section>

      ${renderMessage()}

      <section class="market-product-grid" aria-label="Shopping products">
        ${products.length ? products.map(renderMarketProductCard).join("") : `<div class="empty-state">No products found.</div>`}
      </section>

      <section class="market-faq" aria-labelledby="faqTitle">
        <div>
          <h2 id="faqTitle">zaki - Your go-to place for Online Shopping</h2>
        </div>
        <div class="faq-list">
          ${renderFaqItems()}
        </div>
      </section>
    </main>
    <footer class="market-footer">
      <div class="footer-columns">
        <section><h3>About</h3><a>Contact Us</a><a>About Us</a><a>Careers</a><a>zaki Stories</a></section>
        <section><h3>Group Companies</h3><a>Myntra</a><a>Cleartrip</a><a>Shopsy</a></section>
        <section><h3>Help</h3><a>Payments</a><a>Shipping</a><a>Cancellation & Returns</a><a>FAQ</a></section>
        <section><h3>Consumer Policy</h3><a>Terms Of Use</a><a>Security</a><a>Privacy</a><a>Grievance Redressal</a></section>
        <section><h3>Mail Us</h3><p>zaki Internet Private Limited, Bengaluru, Karnataka, India</p></section>
        <section><h3>Registered Office Address</h3><p>zaki Internet Private Limited, Bengaluru, Karnataka, India</p></section>
      </div>
      <div class="footer-bottom"><span>Become a Seller</span><span>Advertise</span><span>Gift Cards</span><span>Help Center</span><strong>2026 zaki.com</strong></div>
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
  return renderPublicCartPage();
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

function renderSignedHomeSuggestionCard(product, index) {
  return `
    <a class="signed-suggestion-card" href="${escapeHtml(productDetailHref(product))}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy">
      <span>${escapeHtml(product.rating || "4.3")} star</span>
      <b>${index % 2 ? "Deal" : "New"}</b>
    </a>
  `;
}

function renderUserModulePage() {
  const products = visibleProducts().slice(0, 6);
  return `
    ${renderHeader()}
    ${renderCategoryStrip()}
    <main class="home-layout market-home zaki-shell signed-home-page">
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
      <div class="mobile-promo-dots" aria-hidden="true"><span></span><span class="active"></span><span></span><span></span><span></span></div>

      <section class="mobile-deal-strip" aria-label="Hot deals">
        ${mobileDealItems.map(renderMobileDealCard).join("")}
      </section>

      <section class="signed-suggested-section" aria-labelledby="signedSuggestedTitle">
        <div class="signed-section-heading">
          <h2 id="signedSuggestedTitle">Suggested For You</h2>
          <a href="/categories/" aria-label="View all suggested products">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </a>
        </div>
        <div class="signed-suggested-grid">
          ${products.map(renderSignedHomeSuggestionCard).join("")}
        </div>
      </section>
    </main>
    ${renderBottomNav()}
  `;
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
      ${renderModuleCard("Order operations", `Successful: ${statusCount("success")}, failed: ${statusCount("failed")}, cancelled: ${statusCount("cancelled")}.`, `<a class="btn ghost" href="/user/orders/">Open orders</a>`)}
      ${renderModuleCard("Cache operations", "Warm, clear, and inspect user cache keys from the operations page.", `<a class="btn ghost" href="/admin/cache/">Open cache</a>`)}
      ${renderModuleCard("Product operations", "Catalog is code-backed and cached through Upstash for storefront speed.", `<a class="btn ghost" href="/owner/">Open owner</a>`)}
      ${renderModuleCard("Access note", "These module pages are session protected. Add Supabase role claims later for strict permission enforcement.", `<a class="btn primary" href="/development/">Monitor system</a>`)}
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
      ${renderModuleCard("Deployment", `Frontend calls ${escapeHtml(apiBaseUrl)}. Verify Vercel env vars when a module is blank.`, `<a class="btn ghost" href="/admin/cache/">Cache page</a>`)}
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
          <a class="flip-login-close" href="/" aria-label="Close login">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </a>
          <a class="flip-login-brand" href="/" aria-label="zaki home">
            <span>zaki</span><i aria-hidden="true">z</i>
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
        <a class="flip-login-close" href="/" aria-label="Close login">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </a>
        <a class="flip-login-brand" href="/" aria-label="zaki home">
          <span>zaki</span><i aria-hidden="true">z</i>
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
        <p class="login-consent">By continuing, you confirm that you are above 18 years of age, and you agree to zaki's <a href="/login/">Terms of Use</a> and <a href="/login/">Privacy Policy</a></p>
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
        <a class="btn primary wide" href="/login/?next=${encodeURIComponent(currentLocalPath())}">Go to login</a>
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
  } else if (page === "orderSummary") {
    app.innerHTML = renderOrderSummaryPage();
  } else if (page === "orders") {
    app.innerHTML = renderOrdersPage();
  } else if (page === "cache") {
    app.innerHTML = renderCachePage();
  } else if (page === "user") {
    app.innerHTML = renderUserModulePage();
  } else if (page === "payment") {
    app.innerHTML = renderPaymentPage();
  } else if (page === "categories") {
    app.innerHTML = renderCategoriesPage();
  } else if (page === "account") {
    app.innerHTML = renderAccountPage();
  } else if (page === "devices") {
    app.innerHTML = renderDevicesPage();
  } else if (page === "sellerRegister") {
    app.innerHTML = renderSellerRegisterPage();
  } else if (page === "sellerHome") {
    app.innerHTML = renderSellerHomePage();
  } else if (page === "sellerProducts") {
    app.innerHTML = renderSellerProductsPage();
  } else if (page === "sellerOrders") {
    app.innerHTML = renderSellerOrdersPage();
  } else if (page === "sellerAccount") {
    app.innerHTML = renderSellerAccountPage();
  } else if (page === "publicCart") {
    app.innerHTML = renderPublicCartPage();
  } else if (page === "product") {
    app.innerHTML = renderProductPage();
  } else if (page === "owner") {
    window.location.href = "/user/";
  } else if (page === "admin") {
    window.location.href = "/user/";
  } else if (page === "monitoring") {
    window.location.href = "/user/";
  } else if (monitoringPages.has(page)) {
    window.location.href = "/user/";
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
  if (form.dataset.form === "payment-address") {
    await submitPaymentAddress(form);
  }
  if (form.dataset.form === "seller-registration") {
    await submitSellerRegistration(form);
  }
  if (form.dataset.form === "seller-product") {
    await submitSellerProduct(form);
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
  if (action === "app-back") {
    event.preventDefault();
    navigateBack(button.dataset.fallback);
    return;
  }
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
    await buyNow(button.dataset.productId);
  }
  if (action === "quantity") {
    await updateQuantity(button.dataset.productId, Number(button.dataset.direction));
  }
  if (action === "buy-now-quantity") {
    updateBuyNowQuantity(button.dataset.productId, Number(button.dataset.direction));
  }
  if (action === "seller-product-status") {
    await updateSellerProductStatus(button.dataset.productId, button.dataset.status || "active");
  }
  if (action === "clear-cart") {
    await clearCart();
  }
  if (action === "submit-order") {
    await submitOrder(button.dataset.status);
  }
  if (action === "go-payment") {
    goToPayment();
  }
  if (action === "edit-address") {
    state.paymentAddressEdit = true;
    clearMessage();
    render();
  }
  if (action === "cancel-address-edit") {
    state.paymentAddressEdit = false;
    clearMessage();
    render();
  }
  if (action === "continue-payment") {
    await continuePayment();
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
    if (page === "home" || page === "categories" || page === "product") {
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
    const target = window.location.pathname.includes("/admin/cache") ? "/user/cache/" : "/user/";
    window.location.href = state.session ? target : `/login/?next=${encodeURIComponent(target)}`;
    return;
  }

  if (page === "login" && state.session) {
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const nextUrl = await postLoginRedirectPath(requestedNext);
    window.location.href = nextUrl;
    return;
  }

  if (page === "home" && state.session) {
    window.location.href = await sellerHomeForCurrentUser("/user/");
    return;
  }

  if (protectedPages.has(page) && !state.session) {
    window.location.href = `/login/?next=${encodeURIComponent(currentLocalPath())}`;
    return;
  }

  if (page === "payment" && new URLSearchParams(window.location.search).get("step") === "address") {
    window.location.href = "/cart/summary/?edit=address";
    return;
  }

  if (state.session) {
    registerCurrentDevice().catch(() => {});
  }

  render();
  await loadPageData();

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    state.session = nextSession;
    if (!nextSession && protectedPages.has(page)) {
      window.location.href = "/login/";
      return;
    }
    if (nextSession && page === "home") {
      window.location.href = await sellerHomeForCurrentUser("/user/");
      return;
    }
    if (nextSession && page !== "login") {
      await registerCurrentDevice();
      await loadPageData();
      return;
    }
    render();
  });
}

bootstrap();
