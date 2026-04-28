import { CATEGORY_LOOKUP, MENU_LOOKUP } from "./menu-data.js";

const ORDER_PREFIX = "MENU1.";

const elements = {
  orderInput: document.querySelector("#orderInput"),
  parseOrderBtn: document.querySelector("#parseOrderBtn"),
  resetOrderBtn: document.querySelector("#resetOrderBtn"),
  importHint: document.querySelector("#importHint"),
  resultPanel: document.querySelector("#resultPanel"),
  resultMeta: document.querySelector("#resultMeta"),
  resultSummary: document.querySelector("#resultSummary"),
  resultGroups: document.querySelector("#resultGroups"),
};

elements.parseOrderBtn.addEventListener("click", handleParse);
elements.resetOrderBtn.addEventListener("click", resetView);

function handleParse() {
  const input = elements.orderInput.value.trim();

  if (!input) {
    setHint("先粘贴订单码。");
    resetResults();
    return;
  }

  try {
    const payload = decodeOrderCode(input);
    const normalized = normalizePayload(payload);
    renderResults(normalized);
    setHint("订单码解析成功。");
  } catch (error) {
    setHint(error.message || "订单码无法解析。");
    resetResults();
  }
}

function resetView() {
  elements.orderInput.value = "";
  setHint("");
  resetResults();
}

function decodeOrderCode(raw) {
  if (!raw.startsWith(ORDER_PREFIX)) {
    throw new Error("订单码前缀不对，可能不是这个页面生成的。");
  }

  const base64 = raw.slice(ORDER_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
  const normalizedBase64 = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);

  let binary;

  try {
    binary = atob(normalizedBase64);
  } catch (error) {
    throw new Error("订单码内容损坏，Base64 解码失败。");
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error("订单码内容不是合法 JSON。");
  }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("订单内容为空。");
  }

  if (payload.v !== 1) {
    throw new Error("暂不支持这个版本的订单码。");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("订单里没有任何商品。");
  }

  const groups = new Map();
  let totalCount = 0;

  payload.items.forEach((entry) => {
    if (!entry || typeof entry.id !== "string" || !Number.isInteger(entry.qty) || entry.qty <= 0) {
      throw new Error("订单中存在不合法的商品项。");
    }

    const menuItem = MENU_LOOKUP.get(entry.id);
    if (!menuItem) {
      throw new Error(`订单里有未知商品：${entry.id}`);
    }

    const category = CATEGORY_LOOKUP.get(menuItem.category);
    const categoryName = category?.name ?? "未分类";
    const current = groups.get(categoryName) ?? [];

    current.push({
      id: menuItem.id,
      name: menuItem.name,
      description: menuItem.description,
      qty: entry.qty,
      tag: menuItem.tag,
    });

    groups.set(categoryName, current);
    totalCount += entry.qty;
  });

  return {
    createdAt: payload.createdAt,
    totalCount,
    groups: Array.from(groups.entries()).map(([categoryName, items]) => ({
      categoryName,
      items,
    })),
  };
}

function renderResults(result) {
  elements.resultPanel.classList.remove("hidden");
  elements.resultMeta.textContent = formatDate(result.createdAt);

  elements.resultSummary.innerHTML = `
    <div class="result-line">
      <strong class="summary-total">${result.totalCount} 件商品</strong>
      <span class="summary-note">${result.groups.length} 个分类</span>
    </div>
    <div class="result-line">
      <span class="summary-note">这是一份从静态网页订单码还原出来的点单记录。</span>
    </div>
  `;

  elements.resultGroups.innerHTML = "";

  result.groups.forEach((group) => {
    const wrapper = document.createElement("article");
    wrapper.className = "result-group";

    const badge = document.createElement("span");
    badge.className = "result-badge";
    badge.textContent = group.categoryName;

    const title = document.createElement("h3");
    title.textContent = `${group.categoryName} 已选 ${group.items.length} 种`;

    const list = document.createElement("div");
    list.className = "result-items";

    group.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "result-item";
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <p class="result-item-note">${item.description}</p>
        </div>
        <span>x ${item.qty}</span>
      `;
      list.appendChild(row);
    });

    wrapper.appendChild(badge);
    wrapper.appendChild(title);
    wrapper.appendChild(list);
    elements.resultGroups.appendChild(wrapper);
  });
}

function resetResults() {
  elements.resultPanel.classList.add("hidden");
  elements.resultMeta.textContent = "";
  elements.resultSummary.innerHTML = "";
  elements.resultGroups.innerHTML = "";
}

function formatDate(value) {
  if (!value) {
    return "未记录时间";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间格式异常";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function setHint(message) {
  elements.importHint.textContent = message;
}

export { decodeOrderCode, normalizePayload };
