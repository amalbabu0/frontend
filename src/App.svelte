<script>
  import { onMount } from "svelte";
  import { hasSupabaseConfig, supabase } from "./lib/supabase.js";

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

  let authReady = false;
  let authMode = "signin";
  let email = "";
  let password = "";
  let authLoading = false;
  let session = null;
  let products = [];
  let cart = [];
  let orders = [];
  let cache = null;
  let productCache = null;
  let orderFilter = "all";
  let message = "";
  let messageType = "info";

  $: isSignedIn = Boolean(session?.access_token);
  $: userEmail = session?.user?.email || "";
  $: cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  $: cartTotalPaise = cart.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  $: configured = Boolean(cache && cache.configured);
  $: filteredOrders = orderFilter === "all" ? orders : orders.filter((order) => order.status === orderFilter);
  $: cacheMetric = productCache?.hit ? "HIT" : "MISS";
  $: catalogSubcopy = productCache?.error
    ? productCache.error
    : `Source: ${productCache?.source || "origin"} - ${productCache?.key || "catalog"}`;

  function formatMoney(paise) {
    return `Rs ${(Number(paise || 0) / 100).toFixed(2)}`;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function ttlLabel(ttlSeconds) {
    if (ttlSeconds === -1) {
      return "No expiry";
    }

    if (ttlSeconds === -2) {
      return "Missing";
    }

    if (ttlSeconds === undefined || ttlSeconds === null) {
      return "Unknown TTL";
    }

    return `${ttlSeconds}s TTL`;
  }

  function showMessage(text, type = "info") {
    message = text;
    messageType = type;
  }

  function clearMessage() {
    message = "";
    messageType = "info";
  }

  function authHeaders() {
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
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

  async function loadProducts() {
    try {
      const data = await apiRequest("/api/products");
      products = data.products || [];
      productCache = data.cache || {};
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadCart() {
    if (!isSignedIn) {
      cart = [];
      return;
    }

    try {
      const data = await apiRequest("/api/cart");
      cart = data.cart || [];
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadOrders() {
    if (!isSignedIn) {
      orders = [];
      return;
    }

    try {
      const data = await apiRequest("/api/orders");
      orders = data.orders || [];
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadCache() {
    if (!isSignedIn) {
      cache = null;
      return;
    }

    try {
      cache = await apiRequest("/api/cache");
    } catch (error) {
      cache = { configured: false, message: error.message, keys: [] };
    }
  }

  async function loadAppData() {
    await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache()]);
  }

  function cartPayload(items = cart) {
    return items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity
    }));
  }

  async function saveCart(nextCart) {
    cart = nextCart;
    await apiRequest("/api/cart", {
      method: "PUT",
      body: JSON.stringify({ items: cartPayload(nextCart) })
    });
    await loadCache();
  }

  async function addToCart(productId) {
    clearMessage();
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const existing = cart.find((item) => item.productId === productId);
    const nextCart = existing
      ? cart.map((item) => item.productId === productId
          ? { ...item, quantity: Math.min(item.quantity + 1, 20), lineTotalPaise: item.pricePaise * Math.min(item.quantity + 1, 20) }
          : item)
      : [
          ...cart,
          {
            productId: product.id,
            name: product.name,
            pricePaise: product.pricePaise,
            quantity: 1,
            lineTotalPaise: product.pricePaise
          }
        ];

    try {
      await saveCart(nextCart);
    } catch (error) {
      showMessage(error.message, "error");
      await loadCart();
    }
  }

  async function updateQuantity(productId, direction) {
    clearMessage();
    const nextCart = cart
      .map((item) => {
        if (item.productId !== productId) {
          return item;
        }
        const quantity = Math.min(Math.max(item.quantity + direction, 0), 20);
        return { ...item, quantity, lineTotalPaise: item.pricePaise * quantity };
      })
      .filter((item) => item.quantity > 0);

    try {
      await saveCart(nextCart);
    } catch (error) {
      showMessage(error.message, "error");
      await loadCart();
    }
  }

  async function submitOrder(status) {
    clearMessage();
    if (!cart.length) {
      return;
    }

    try {
      const data = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({ items: cartPayload(), status })
      });
      cart = [];
      showMessage(`${data.order.id} saved as ${data.order.status}.`);
      await Promise.all([loadOrders(), loadCache()]);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function updateOrderStatus(orderId, status) {
    clearMessage();
    try {
      const data = await apiRequest(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      showMessage(`${data.order.id} updated to ${data.order.status}.`);
      await Promise.all([loadOrders(), loadCache()]);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function runCacheAction(action) {
    clearMessage();
    try {
      const data = await apiRequest("/api/cache", {
        method: "POST",
        body: JSON.stringify({ action })
      });
      cache = data;
      showMessage(data.message || "Cache updated.");
      await Promise.all([loadProducts(), loadCart(), loadOrders(), loadCache()]);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function reloadProducts() {
    clearMessage();
    await Promise.all([loadProducts(), loadCache()]);
  }

  async function submitAuth() {
    clearMessage();
    if (!hasSupabaseConfig || !supabase) {
      showMessage("Supabase frontend env vars are missing.", "error");
      return;
    }

    authLoading = true;
    try {
      const authCall = authMode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
      const { data, error } = await authCall;
      if (error) {
        throw error;
      }

      session = data.session;
      if (!data.session) {
        showMessage("Account created. Check your email if Supabase requires confirmation.");
      } else {
        await loadAppData();
      }
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      authLoading = false;
    }
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    session = null;
    cart = [];
    orders = [];
    cache = null;
    showMessage("Signed out.");
  }

  onMount(async () => {
    if (!hasSupabaseConfig || !supabase) {
      authReady = true;
      showMessage("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.", "error");
      return;
    }

    const { data } = await supabase.auth.getSession();
    session = data.session;
    authReady = true;
    if (session) {
      await loadAppData();
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      session = nextSession;
      if (nextSession) {
        await loadAppData();
      }
    });

    return () => listener.subscription.unsubscribe();
  });
</script>

<svelte:head>
  <title>Cache Commerce</title>
</svelte:head>

{#if !authReady}
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="brand auth-brand">
        <div class="brand-mark">CC</div>
        <div>
          <h1>Cache Commerce</h1>
          <p>Loading session.</p>
        </div>
      </div>
    </section>
  </main>
{:else if !isSignedIn}
  <main class="auth-shell">
    <section class="auth-panel" aria-labelledby="loginTitle">
      <div class="brand auth-brand">
        <div class="brand-mark">CC</div>
        <div>
          <h1 id="loginTitle">Cache Commerce</h1>
          <p>Sign in to sync your cart and orders through FastAPI cache.</p>
        </div>
      </div>

      {#if message}
        <div class:error={messageType === "error"} class="message">{message}</div>
      {/if}

      <div class="auth-tabs" aria-label="Authentication mode">
        <button class:active={authMode === "signin"} type="button" onclick={() => authMode = "signin"}>Sign In</button>
        <button class:active={authMode === "signup"} type="button" onclick={() => authMode = "signup"}>Create Account</button>
      </div>

      <form class="auth-form" onsubmit={(event) => { event.preventDefault(); submitAuth(); }}>
        <label>
          Email
          <input bind:value={email} type="email" autocomplete="email" required>
        </label>
        <label>
          Password
          <input bind:value={password} type="password" autocomplete={authMode === "signin" ? "current-password" : "new-password"} minlength="6" required>
        </label>
        <button class="btn primary" type="submit" disabled={authLoading}>
          {authLoading ? "Please wait" : authMode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </section>
  </main>
{:else}
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">CC</div>
        <div>
          <h1>Cache Commerce</h1>
          <p>Storefront, cart, orders and per-user Upstash cache.</p>
        </div>
      </div>
      <div class="user-actions">
        <span class:connected={configured} class="status-pill">
          {configured ? "Upstash connected" : "Upstash missing"}
        </span>
        <span class="mini-pill">{userEmail}</span>
        <button class="btn small" type="button" onclick={signOut}>Sign Out</button>
      </div>
    </header>

    <main class="layout">
      <section class="surface" aria-labelledby="catalogTitle">
        <div class="section-head">
          <div>
            <p class="eyebrow">Live catalog</p>
            <h2 id="catalogTitle">Products</h2>
            <p>{catalogSubcopy}</p>
          </div>
          <div class="toolbar">
            <button class="btn" type="button" onclick={reloadProducts}>Reload Products</button>
          </div>
        </div>

        <div class="summary-strip" aria-label="Store metrics">
          <div class="metric">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>
          <div class="metric">
            <span>Cart</span>
            <strong>{cartCount} {cartCount === 1 ? "item" : "items"}</strong>
          </div>
          <div class="metric">
            <span>Cache</span>
            <strong>{cacheMetric}</strong>
          </div>
        </div>

        {#if message}
          <div class:error={messageType === "error"} class="message">{message}</div>
        {/if}

        <div class="product-grid">
          {#if products.length}
            {#each products as product (product.id)}
              <article class="product-card">
                <div class="product-media">
                  <img src={product.image} alt={product.alt}>
                </div>
                <div class="product-body">
                  <div class="product-top">
                    <h3>{product.name}</h3>
                    <span class="badge">{product.badge}</span>
                  </div>
                  <p>{product.description}</p>
                </div>
                <div class="product-foot">
                  <span class="price">{formatMoney(product.pricePaise)}</span>
                  <button class="btn primary small" type="button" onclick={() => addToCart(product.id)}>
                    Add to Cart
                  </button>
                </div>
              </article>
            {/each}
          {:else}
            <div class="empty">No products found.</div>
          {/if}
        </div>
      </section>

      <aside class="right-column">
        <section class="side-panel" aria-labelledby="cartTitle">
          <div class="panel-title">
            <h2 id="cartTitle">Cart</h2>
            <span class:success={cartCount > 0} class="mini-pill">
              {cartCount ? "Synced" : "Empty"}
            </span>
          </div>

          <div class="cart-items">
            {#if cart.length}
              {#each cart as item (item.productId)}
                <div class="cart-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.pricePaise)} each</span>
                  </div>
                  <div class="qty-control" aria-label={`Quantity for ${item.name}`}>
                    <button type="button" onclick={() => updateQuantity(item.productId, -1)}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onclick={() => updateQuantity(item.productId, 1)}>+</button>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="empty">Cart is empty.</div>
            {/if}
          </div>

          <div class="cart-total">
            <span>Total</span>
            <strong>{formatMoney(cartTotalPaise)}</strong>
          </div>
          <div class="checkout-actions">
            <button class="btn positive" type="button" disabled={cartCount === 0} onclick={() => submitOrder("success")}>
              Place Order
            </button>
            <button class="btn warning" type="button" disabled={cartCount === 0} onclick={() => submitOrder("failed")}>
              Failed Order
            </button>
          </div>
        </section>

        <section class="side-panel" aria-labelledby="cacheTitle">
          <div class="panel-title">
            <h2 id="cacheTitle">Cache Manager</h2>
            <span class:success={configured} class="mini-pill">{configured ? "Online" : "Offline"}</span>
          </div>
          <div class="cache-actions">
            <button class="btn small" type="button" onclick={() => runCacheAction("warm-all")}>Warm Mine</button>
            <button class="btn small" type="button" onclick={() => runCacheAction("refresh-products")}>Refresh Products</button>
            <button class="btn small" type="button" onclick={() => runCacheAction("clear-products")}>Clear Products</button>
            <button class="btn small danger" type="button" onclick={() => runCacheAction("clear-my-cache")}>Clear Mine</button>
          </div>
          <div class="cache-keys">
            {#if !cache}
              <div class="empty">Cache status loading.</div>
            {:else if !configured}
              <div class="empty">{cache.message}</div>
            {:else if cache.keys.length}
              {#each cache.keys as entry (entry.key)}
                <div class="cache-row">
                  <strong>{entry.key}</strong>
                  <span>{ttlLabel(entry.ttlSeconds)}</span>
                </div>
              {/each}
            {:else}
              <div class="empty">No cache keys found.</div>
            {/if}
          </div>
        </section>
      </aside>
    </main>

    <section class="orders-panel" aria-labelledby="ordersTitle">
      <div class="orders-head">
        <div>
          <p class="eyebrow">History</p>
          <h2 id="ordersTitle">Orders</h2>
        </div>
        <select bind:value={orderFilter} class="orders-filter" aria-label="Filter orders">
          <option value="all">All orders</option>
          <option value="success">Successful</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div class="orders-list">
        {#if filteredOrders.length}
          {#each filteredOrders as order (order.id)}
            <article class="order-row">
              <div class="order-main">
                <strong>{order.id}</strong>
                <span>
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"} -
                  {formatMoney(order.totalPaise)} - {formatDate(order.createdAt)}
                </span>
                <div class="order-meta">
                  <span class:success={order.status === "success"} class:failed={order.status === "failed"} class:cancelled={order.status === "cancelled"} class="mini-pill">
                    {order.status}
                  </span>
                  <span class="mini-pill">{order.items.map((item) => item.name).join(", ")}</span>
                </div>
              </div>
              <div class="order-actions">
                <button
                  class="btn small danger"
                  type="button"
                  disabled={order.status !== "success"}
                  onclick={() => updateOrderStatus(order.id, "cancelled")}
                >
                  Cancel
                </button>
              </div>
            </article>
          {/each}
        {:else}
          <div class="empty">No matching orders.</div>
        {/if}
      </div>
    </section>
  </div>
{/if}
