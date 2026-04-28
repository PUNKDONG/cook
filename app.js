import { CATEGORY_LOOKUP, CATEGORY_ORDER, MENU_ITEMS } from "./menu-data.js";

const STORAGE_KEY = "cook-gf-order-cart";
const ORDER_PREFIX = "MENU1.";

const state = {
  activeCategoryId: CATEGORY_ORDER[0].id,
  cart: loadCart(),
};

const elements = {
  categoryTabs: document.querySelector("#categoryTabs"),
  categoryLabel: document.querySelector("#categoryLabel"),
  categoryTitle: document.querySelector("#categoryTitle"),
  menuGrid: document.querySelector("#menuGrid"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  cartFab: document.querySelector("#cartFab"),
  cartDrawer: document.querySelector("#cartDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  closeDrawerBtn: document.querySelector("#closeDrawerBtn"),
  cartItems: document.querySelector("#cartItems"),
  cartCount: document.querySelector("#cartCount"),
  cartSummary: document.querySelector("#cartSummary"),
  cartMeta: document.querySelector("#cartMeta"),
  footerCount: document.querySelector("#footerCount"),
  copyOrderBtn: document.querySelector("#copyOrderBtn"),
  orderResultCard: document.querySelector("#orderResultCard"),
  orderCodeOutput: document.querySelector("#orderCodeOutput"),
  copyHint: document.querySelector("#copyHint"),
  menuItemTemplate: document.querySelector("#menuItemTemplate"),
  cartItemTemplate: document.querySelector("#cartItemTemplate"),
};

render();
bindEvents();

function bindEvents() {
  elements.clearCartBtn.addEventListener("click", () => {
    state.cart = {};
    syncCart();
    setHint("购物车已经清空。");
  });

  elements.cartFab.addEventListener("click", () => toggleDrawer(true));
  elements.drawerBackdrop.addEventListener("click", () => toggleDrawer(false));
  elements.closeDrawerBtn.addEventListener("click", () => toggleDrawer(false));

  elements.copyOrderBtn.addEventListener("click", async () => {
    if (getTotalCount() === 0) {
      setHint("先选几样东西，再生成订单码。");
      return;
    }

    const code = buildOrderCode();
    elements.orderCodeOutput.value = code;
    elements.orderResultCard.classList.remove("hidden");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setHint("订单码已复制。你现在可以直接发给自己。");
      } else {
        elements.orderCodeOutput.focus();
        elements.orderCodeOutput.select();
        setHint("订单码已生成。当前环境不支持自动复制，请手动复制。");
      }
    } catch (error) {
      elements.orderCodeOutput.focus();
      elements.orderCodeOutput.select();
      setHint("订单码已生成，但自动复制失败，请手动复制。");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleDrawer(false);
    }
  });
}

function render() {
  renderCategories();
  renderMenu();
  renderCart();
  updateCartSummary();
}

function renderCategories() {
  elements.categoryTabs.innerHTML = "";

  CATEGORY_ORDER.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-tab ${category.id === state.activeCategoryId ? "active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(category.id === state.activeCategoryId));
    button.innerHTML = `<strong>${category.name}</strong><span>${category.description}</span>`;
    button.addEventListener("click", () => {
      state.activeCategoryId = category.id;
      renderCategories();
      renderMenu();
    });

    elements.categoryTabs.appendChild(button);
  });

  const activeCategory = CATEGORY_LOOKUP.get(state.activeCategoryId);
  elements.categoryLabel.textContent = "当前分类";
  elements.categoryTitle.textContent = activeCategory?.name ?? "";
}

function renderMenu() {
  elements.menuGrid.innerHTML = "";

  const items = MENU_ITEMS.filter((item) => item.category === state.activeCategoryId);
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const node = elements.menuItemTemplate.content.firstElementChild.cloneNode(true);
    const quantity = state.cart[item.id] ?? 0;
    const imageWrap = node.querySelector(".menu-image");
    const image = node.querySelector(".menu-photo");
    const imageBadge = node.querySelector(".menu-image-badge");

    node.querySelector(".menu-tag").textContent = item.tag;
    node.querySelector(".menu-selected").textContent = quantity > 0 ? `已选 ${quantity}` : "可加购";
    node.querySelector(".menu-name").textContent = item.name;
    node.querySelector(".menu-description").textContent = item.description;
    node.querySelector(".qty-value").textContent = quantity;

    if (item.image) {
      image.src = item.image;
      image.alt = item.name;
      imageWrap.classList.add("has-image");
      imageBadge.hidden = true;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      imageWrap.classList.remove("has-image");
      imageBadge.hidden = false;
    }

    node.querySelector(".minus-button").addEventListener("click", () => updateQuantity(item.id, -1));
    node.querySelector(".plus-button").addEventListener("click", () => updateQuantity(item.id, 1));

    fragment.appendChild(node);
  });

  elements.menuGrid.appendChild(fragment);
}

function renderCart() {
  elements.cartItems.innerHTML = "";

  const cartEntries = getCartEntries();

  if (cartEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "现在购物车还是空的。先去点几样想要的，再回来生成订单码。";
    elements.cartItems.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  cartEntries.forEach(({ item, quantity }) => {
    const node = elements.cartItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".cart-item-category").textContent = CATEGORY_LOOKUP.get(item.category)?.name ?? "未分类";
    node.querySelector(".cart-item-name").textContent = item.name;
    node.querySelector(".qty-value").textContent = quantity;
    node.querySelector(".minus-button").addEventListener("click", () => updateQuantity(item.id, -1));
    node.querySelector(".plus-button").addEventListener("click", () => updateQuantity(item.id, 1));
    fragment.appendChild(node);
  });

  elements.cartItems.appendChild(fragment);
}

function updateQuantity(itemId, delta) {
  const nextQuantity = Math.max(0, (state.cart[itemId] ?? 0) + delta);

  if (nextQuantity === 0) {
    delete state.cart[itemId];
  } else {
    state.cart[itemId] = nextQuantity;
  }

  syncCart();
}

function syncCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
  elements.orderResultCard.classList.add("hidden");
  elements.orderCodeOutput.value = "";
  renderMenu();
  renderCart();
  updateCartSummary();
}

function updateCartSummary() {
  const totalCount = getTotalCount();
  elements.cartCount.textContent = String(totalCount);
  elements.footerCount.textContent = `${totalCount} 件商品`;
  elements.cartSummary.textContent = totalCount > 0 ? `已选 ${totalCount} 件商品` : "购物车还是空的";
  elements.cartMeta.textContent = totalCount > 0 ? "点这里确认并生成订单码" : "先选商品，再去结算";
}

function getTotalCount() {
  return Object.values(state.cart).reduce((sum, quantity) => sum + quantity, 0);
}

function getCartEntries() {
  return Object.entries(state.cart)
    .map(([itemId, quantity]) => {
      const item = MENU_ITEMS.find((entry) => entry.id === itemId);
      return item ? { item, quantity } : null;
    })
    .filter(Boolean);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0),
    );
  } catch (error) {
    return {};
  }
}

function buildOrderCode() {
  const payload = {
    v: 1,
    createdAt: new Date().toISOString(),
    items: getCartEntries().map(({ item, quantity }) => ({
      id: item.id,
      qty: quantity,
    })),
  };

  return ORDER_PREFIX + encodePayload(payload);
}

function encodePayload(payload) {
  const json = JSON.stringify(payload);
  const utf8 = new TextEncoder().encode(json);
  let binary = "";

  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toggleDrawer(isOpen) {
  elements.cartDrawer.classList.toggle("open", isOpen);
  elements.cartDrawer.setAttribute("aria-hidden", String(!isOpen));
  elements.cartFab.setAttribute("aria-expanded", String(isOpen));
}

function setHint(message) {
  elements.copyHint.textContent = message;
}

export { buildOrderCode, encodePayload, ORDER_PREFIX };
