const DB_KEY = "stockora_business_os_v3";

let db = {
  products: [],
  sales: [],
  expenses: [],
  customers: [],
  suppliers: [],
  restocks: [],
  activity: [],
  settings: {
    businessName: "My Business",
    address: "",
    phone: ""
  }
};

let cart = [];
let billImage = "";
let productImage = "";

/* =========================
   DATABASE
========================= */

function loadData() {
  const saved = localStorage.getItem(DB_KEY);

  if (saved) {
    try {
      db = JSON.parse(saved);
    } catch (error) {
      console.error("Could not load data");
    }
  }

  db.products ||= [];
  db.sales ||= [];
  db.expenses ||= [];
  db.customers ||= [];
  db.suppliers ||= [];
  db.restocks ||= [];
  db.activity ||= [];
  db.settings ||= {
    businessName: "My Business",
    address: "",
    phone: ""
  };
}

function saveData() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  refreshAll();
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(message) {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}

function addActivity(text) {
  db.activity.unshift({
    id: id(),
    text,
    date: new Date().toLocaleString()
  });

  db.activity = db.activity.slice(0, 30);
}

/* =========================
   NAVIGATION
========================= */

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    openPage(button.dataset.page);
  });
});

function openPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById(pageName).classList.add("active");

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  const titles = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    scanners: "Smart Scanners",
    pos: "POS & Billing",
    restock: "Restock",
    expenses: "Expenses",
    sales: "Sales History",
    customers: "Customers",
    suppliers: "Suppliers",
    analytics: "Analytics",
    reports: "Reports",
    settings: "Settings & Backup"
  };

  document.getElementById("pageTitle").textContent =
    titles[pageName] || "STOCKORA";

  refreshAll();

  document.getElementById("sidebar").classList.remove("open");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function toggle(elementId) {
  document.getElementById(elementId).classList.toggle("hidden");
}

/* =========================
   DASHBOARD
========================= */

function getRevenue() {
  return db.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
}

function getProductProfit() {
  let profit = 0;

  db.sales.forEach(sale => {
    sale.items.forEach(item => {
      const product = item.productSnapshot || {};
      profit +=
        (Number(item.price) - Number(product.cost || 0)) *
        Number(item.qty);
    });
  });

  return profit;
}

function getExpenses() {
  return db.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );
}

function getNetProfit() {
  return getProductProfit() - getExpenses();
}

function updateDashboard() {
  const totalStock = db.products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  document.getElementById("dProducts").textContent =
    db.products.length;

  document.getElementById("dStock").textContent =
    totalStock;

  document.getElementById("dRevenue").textContent =
    money(getRevenue());

  document.getElementById("dProfit").textContent =
    money(getNetProfit());

  updateHealth();
  renderAlerts();
  renderActivity();
  renderTopProducts();
}

function updateHealth() {
  let score = 40;

  if (db.products.length > 0) score += 20;
  if (db.sales.length > 0) score += 15;

  const low = db.products.filter(product =>
    Number(product.stock) <= Number(product.min || 5)
  ).length;

  score -= Math.min(low * 5, 30);

  if (getNetProfit() > 0) score += 15;

  score = Math.max(0, Math.min(100, score));

  document.getElementById("healthScore").textContent = score;

  let label = "STARTING";
  let message = "Your business is ready to grow.";

  if (score >= 80) {
    label = "EXCELLENT";
    message = "Your business is performing strongly.";
  } else if (score >= 60) {
    label = "GOOD";
    message = "Your business is healthy with room to improve.";
  } else if (score >= 40) {
    label = "NEEDS ATTENTION";
    message = "Check inventory and sales performance.";
  } else {
    label = "STARTING";
    message = "Add products and start recording sales.";
  }

  document.getElementById("healthLabel").textContent = label;
  document.getElementById("healthMessage").textContent = message;
}

function renderAlerts() {
  const lowProducts = db.products.filter(product =>
    Number(product.stock) <= Number(product.min || 5)
  );

  const container = document.getElementById("dashboardAlerts");
  const alertCount = document.getElementById("alertCount");

  alertCount.textContent = lowProducts.length;

  if (!lowProducts.length) {
    container.innerHTML = `
      <div class="activity">
        ✓ No urgent stock alerts. Your inventory looks good.
      </div>
    `;
    return;
  }

  container.innerHTML = lowProducts.map(product => {
    const out = Number(product.stock) === 0;

    return `
      <div class="alert ${out ? "danger-alert" : ""}">
        <b>${out ? "Out of stock" : "Low stock"}:</b>
        ${escapeHTML(product.name)}
        <br>
        <small>${product.stock} units remaining</small>
      </div>
    `;
  }).join("");
}

function renderActivity() {
  const container = document.getElementById("activityList");

  if (!db.activity.length) {
    container.innerHTML = `
      <div class="activity">
        <b>Welcome to STOCKORA!</b>
        <br>
        <small>Add your first product to begin.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = db.activity.slice(0, 8).map(item => `
    <div class="activity">
      <b>${escapeHTML(item.text)}</b>
      <br>
      <small>${item.date}</small>
    </div>
  `).join("");
}

function getTopProductData() {
  const map = {};

  db.sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!map[item.name]) {
        map[item.name] = {
          qty: 0,
          revenue: 0
        };
      }

      map[item.name].qty += Number(item.qty);
      map[item.name].revenue += Number(item.total);
    });
  });

  return Object.entries(map)
    .sort((a, b) => b[1].qty - a[1].qty);
}

function renderTopProducts() {
  const container = document.getElementById("topProducts");
  const products = getTopProductData().slice(0, 5);

  if (!products.length) {
    container.innerHTML = `
      <div class="activity">
        No sales data yet.
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(([name, data], index) => `
    <div class="list-row">
      <b>#${index + 1} ${escapeHTML(name)}</b>
      <br>
      <small>${data.qty} sold · ${money(data.revenue)}</small>
    </div>
  `).join("");
}

/* =========================
   INVENTORY
========================= */

function renderInventory() {
  const container = document.getElementById("inventoryGrid");

  const search =
    document.getElementById("inventorySearch").value
      .trim()
      .toLowerCase();

  const filter =
    document.getElementById("inventoryFilter").value;

  let products = db.products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search) ||
      (product.sku || "").toLowerCase().includes(search) ||
      (product.barcode || "").toLowerCase().includes(search);

    let matchesFilter = true;

    if (filter === "out") {
      matchesFilter = Number(product.stock) === 0;
    }

    if (filter === "low") {
      matchesFilter =
        Number(product.stock) > 0 &&
        Number(product.stock) <= Number(product.min || 5);
    }

    if (filter === "healthy") {
      matchesFilter =
        Number(product.stock) > Number(product.min || 5);
    }

    return matchesSearch && matchesFilter;
  });

  if (!products.length) {
    container.innerHTML = `
      <div class="panel">
        <h3>No products found</h3>
        <p>Add products using Scanner 2.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => {
    let status = "healthy";
    let statusText = `${product.stock} in stock`;

    if (Number(product.stock) === 0) {
      status = "out";
      statusText = "Out of stock";
    } else if (
      Number(product.stock) <= Number(product.min || 5)
    ) {
      status = "low";
      statusText = `Low: ${product.stock}`;
    }

    const image = product.image
      ? `<img src="${product.image}" alt="${escapeHTML(product.name)}">`
      : `<div class="product-placeholder">📦</div>`;

    return `
      <div class="product-card">
        ${image}

        <div class="product-info">
          <h3>${escapeHTML(product.name)}</h3>
          <small>${escapeHTML(product.category || "Uncategorized")}</small>

          <div class="product-price">
            ${money(product.price)}
          </div>

          <span class="stock-badge ${status}">
            ${statusText}
          </span>

          <div class="product-actions">
            <button onclick="quickAddCart('${product.id}')">
              + Sell
            </button>

            <button onclick="deleteProduct('${product.id}')">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function addProduct() {
  const name = document.getElementById("pName").value.trim();
  const stock = Number(document.getElementById("pStock").value);
  const price = Number(document.getElementById("pPrice").value);

  if (!name) {
    toast("Please enter a product name.");
    return;
  }

  if (Number.isNaN(stock) || stock < 0) {
    toast("Enter a valid stock amount.");
    return;
  }

  if (Number.isNaN(price) || price < 0) {
    toast("Enter a valid selling price.");
    return;
  }

  const product = {
    id: id(),
    name,
    category: document.getElementById("pCategory").value.trim(),
    sku: document.getElementById("pSKU").value.trim(),
    barcode: document.getElementById("pBarcode").value.trim(),
    stock,
    min: Number(document.getElementById("pMin").value || 5),
    cost: Number(document.getElementById("pCost").value || 0),
    price,
    supplier: document.getElementById("pSupplier").value,
    expiry: document.getElementById("pExpiry").value,
    location: document.getElementById("pLocation").value.trim(),
    notes: document.getElementById("pNotes").value.trim(),
    image: productImage,
    createdAt: new Date().toLocaleString()
  };

  db.products.push(product);

  addActivity(`Added product: ${name}`);

  clearProductForm();

  saveData();

  toast(`${name} added to inventory!`);

  openPage("inventory");
}

function clearProductForm() {
  [
    "pName",
    "pCategory",
    "pSKU",
    "pBarcode",
    "pStock",
    "pCost",
    "pPrice",
    "pExpiry",
    "pLocation",
    "pNotes"
  ].forEach(element => {
    document.getElementById(element).value = "";
  });

  document.getElementById("pMin").value = 5;

  productImage = "";

  const preview = document.getElementById("productPreview");
  preview.src = "";
  preview.style.display = "none";

  document.getElementById("productPreviewText").style.display = "grid";
}

function deleteProduct(productId) {
  const product = db.products.find(p => p.id === productId);

  if (!product) return;

  if (!confirm(`Delete ${product.name}?`)) return;

  db.products = db.products.filter(p => p.id !== productId);

  cart = cart.filter(item => item.productId !== productId);

  addActivity(`Deleted product: ${product.name}`);

  saveData();

  toast("Product deleted.");
}

/* =========================
   IMAGE UPLOAD
========================= */

function previewImage(event, targetId) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    const image = document.getElementById(targetId);

    image.src = e.target.result;
    image.style.display = "block";

    const text = document.getElementById(targetId + "Text");

    if (text) text.style.display = "none";

    if (targetId === "billPreview") {
      billImage = e.target.result;
    }

    if (targetId === "productPreview") {
      productImage = e.target.result;
    }
  };

  reader.readAsDataURL(file);
}

/* =========================
   SCANNER TABS
========================= */

function selectScanner(number) {
  document.querySelectorAll(".scanner-view").forEach(view => {
    view.classList.remove("active");
  });

  document.querySelectorAll(".scanner-tab").forEach(tab => {
    tab.classList.remove("active");
  });

  document.getElementById(`scanner${number}`)
    .classList.add("active");

  document.querySelectorAll(".scanner-tab")[number - 1]
    .classList.add("active");

  if (number === 1) {
    if (!document.getElementById("billRows").children.length) {
      addBillRow();
    }
  }

  if (number === 3) {
    if (!document.getElementById("s3Rows").children.length) {
      addS3Row();
    }
  }
}

/* =========================
   PRODUCT OPTIONS
========================= */

function productOptions(selected = "") {
  return `
    <option value="">Select product</option>
    ${db.products.map(product => `
      <option value="${product.id}"
        ${product.id === selected ? "selected" : ""}>
        ${escapeHTML(product.name)} (${product.stock} available)
      </option>
    `).join("")}
  `;
}

/* =========================
   SCANNER 1
========================= */

function addBillRow() {
  const container = document.getElementById("billRows");

  const row = document.createElement("div");

  row.className = "sale-row";

  row.innerHTML = `
    <select onchange="calculateBillTotal()">
      ${productOptions()}
    </select>

    <input type="number" min="1" value="1"
      oninput="calculateBillTotal()">

    <button class="remove-row"
      onclick="this.parentElement.remove();calculateBillTotal()">
      ×
    </button>
  `;

  container.appendChild(row);
}

function getBillItems() {
  const rows =
    document.querySelectorAll("#billRows .sale-row");

  const items = [];

  rows.forEach(row => {
    const productId = row.querySelector("select").value;
    const qty = Number(row.querySelector("input").value || 0);

    const product =
      db.products.find(p => p.id === productId);

    if (product && qty > 0) {
      items.push({
        productId,
        name: product.name,
        qty,
        price: Number(product.price),
        total: Number(product.price) * qty,
        productSnapshot: {
          cost: Number(product.cost)
        }
      });
    }
  });

  return items;
}

function calculateBillTotal() {
  const total = getBillItems()
    .reduce((sum, item) => sum + item.total, 0);

  document.getElementById("billTotal").textContent =
    money(total);
}

function completeBillScan() {
  const items = getBillItems();

  if (!items.length) {
    toast("Add at least one product.");
    return;
  }

  if (!validateStock(items)) return;

  const total =
    items.reduce((sum, item) => sum + item.total, 0);

  finishSale({
    items,
    total,
    customer: "Bill Scan Customer",
    phone: "",
    payment: "Bill Scanner",
    source: "Scanner 1",
    billImage
  });

  document.getElementById("billRows").innerHTML = "";
  addBillRow();

  toast("Sale recorded and stock deducted!");
}

/* =========================
   SCANNER 3
========================= */

function addS3Row() {
  const container = document.getElementById("s3Rows");

  const row = document.createElement("div");

  row.className = "sale-row";

  row.innerHTML = `
    <select onchange="calculateS3()">
      ${productOptions()}
    </select>

    <input type="number" min="1" value="1"
      oninput="calculateS3()">

    <button class="remove-row"
      onclick="this.parentElement.remove();calculateS3()">
      ×
    </button>
  `;

  container.appendChild(row);
}

function getS3Items() {
  const rows =
    document.querySelectorAll("#s3Rows .sale-row");

  const items = [];

  rows.forEach(row => {
    const productId = row.querySelector("select").value;
    const qty = Number(row.querySelector("input").value || 0);

    const product =
      db.products.find(p => p.id === productId);

    if (product && qty > 0) {
      items.push({
        productId,
        name: product.name,
        qty,
        price: Number(product.price),
        total: Number(product.price) * qty,
        productSnapshot: {
          cost: Number(product.cost)
        }
      });
    }
  });

  return items;
}

function calculateS3() {
  const items = getS3Items();

  const subtotal =
    items.reduce((sum, item) => sum + item.total, 0);

  const discount =
    Number(document.getElementById("s3Discount").value || 0);

  const taxPercent =
    Number(document.getElementById("s3Tax").value || 0);

  const afterDiscount =
    Math.max(0, subtotal - discount);

  const tax =
    afterDiscount * taxPercent / 100;

  const total =
    afterDiscount + tax;

  document.getElementById("s3Subtotal").textContent =
    money(subtotal);

  document.getElementById("s3DiscountAmount").textContent =
    money(discount);

  document.getElementById("s3TaxAmount").textContent =
    money(tax);

  document.getElementById("s3Grand").textContent =
    money(total);
}

function completeS3() {
  const items = getS3Items();

  if (!items.length) {
    toast("Add products to the bill.");
    return;
  }

  if (!validateStock(items)) return;

  const subtotal =
    items.reduce((sum, item) => sum + item.total, 0);

  const discount =
    Number(document.getElementById("s3Discount").value || 0);

  const taxPercent =
    Number(document.getElementById("s3Tax").value || 0);

  const afterDiscount =
    Math.max(0, subtotal - discount);

  const tax =
    afterDiscount * taxPercent / 100;

  const total =
    afterDiscount + tax;

  const customer =
    document.getElementById("s3Customer").value.trim() ||
    "Walk-in Customer";

  const phone =
    document.getElementById("s3Phone").value.trim();

  const payment =
    document.getElementById("s3Payment").value;

  const sale = finishSale({
    items,
    total,
    customer,
    phone,
    payment,
    source: "Scanner 3",
    discount,
    tax
  });

  showInvoice(sale);

  document.getElementById("s3Rows").innerHTML = "";
  addS3Row();

  toast("Professional invoice created!");
}

function showInvoice(sale) {
  const business =
    escapeHTML(db.settings.businessName || "My Business");

  const address =
    escapeHTML(db.settings.address || "");

  document.getElementById("invoicePreview").innerHTML = `
    <div class="invoice">
      <h2>${business}</h2>
      <p>${address}</p>
      <hr>

      <p><b>Invoice:</b> ${sale.invoice}</p>
      <p><b>Date:</b> ${sale.date}</p>
      <p><b>Customer:</b> ${escapeHTML(sale.customer)}</p>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td>${escapeHTML(item.name)}</td>
              <td>${item.qty}</td>
              <td>${money(item.total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <h2 style="text-align:right;margin-top:20px">
        Total: ${money(sale.total)}
      </h2>

      <p style="margin-top:20px">
        Payment: ${escapeHTML(sale.payment)}
      </p>

      <p>Thank you for shopping!</p>
    </div>
  `;
}

/* =========================
   POS
========================= */

function renderPOSProducts() {
  const container =
    document.getElementById("posProducts");

  const search =
    document.getElementById("posSearch").value
      .toLowerCase();

  const products = db.products.filter(product =>
    product.name.toLowerCase().includes(search) &&
    Number(product.stock) > 0
  );

  if (!products.length) {
    container.innerHTML = "No available products.";
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="pos-product"
      onclick="quickAddCart('${product.id}')">
      📦
      <strong>${escapeHTML(product.name)}</strong>
      <small>${product.stock} available</small>
      <b>${money(product.price)}</b>
    </div>
  `).join("");
}

function quickAddCart(productId) {
  const product =
    db.products.find(p => p.id === productId);

  if (!product) return;

  const existing =
    cart.find(item => item.productId === productId);

  if (existing) {
    if (existing.qty >= Number(product.stock)) {
      toast("Maximum available stock reached.");
      return;
    }

    existing.qty++;
  } else {
    if (Number(product.stock) <= 0) {
      toast("This product is out of stock.");
      return;
    }

    cart.push({
      productId,
      name: product.name,
      price: Number(product.price),
      qty: 1,
      productSnapshot: {
        cost: Number(product.cost)
      }
    });
  }

  renderCart();
}

function renderCart() {
  const container =
    document.getElementById("cart");

  if (!cart.length) {
    container.innerHTML = `
      <div class="activity">
        Your cart is empty.
      </div>
    `;
  } else {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div>
          <b>${escapeHTML(item.name)}</b>
          <br>
          <small>${money(item.price)} each</small>
        </div>

        <div class="cart-controls">
          <button onclick="changeCartQty('${item.productId}',-1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeCartQty('${item.productId}',1)">+</button>
        </div>
      </div>
    `).join("");
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  document.getElementById("cartTotal").textContent =
    money(total);
}

function changeCartQty(productId, change) {
  const item =
    cart.find(item => item.productId === productId);

  const product =
    db.products.find(product => product.id === productId);

  if (!item || !product) return;

  if (change > 0 && item.qty >= Number(product.stock)) {
    toast("Not enough stock.");
    return;
  }

  item.qty += change;

  if (item.qty <= 0) {
    cart = cart.filter(item => item.productId !== productId);
  }

  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function completePOS() {
  if (!cart.length) {
    toast("Your cart is empty.");
    return;
  }

  const items = cart.map(item => ({
    ...item,
    total: item.price * item.qty
  }));

  if (!validateStock(items)) return;

  const total =
    items.reduce((sum, item) => sum + item.total, 0);

  finishSale({
    items,
    total,
    customer:
      document.getElementById("posCustomer").value.trim() ||
      "Walk-in Customer",
    phone:
      document.getElementById("posPhone").value.trim(),
    payment:
      document.getElementById("posPayment").value,
    source: "POS"
  });

  cart = [];

  document.getElementById("posCustomer").value = "";
  document.getElementById("posPhone").value = "";

  renderCart();

  toast("Sale completed successfully!");
}

/* =========================
   SALE ENGINE
========================= */

function validateStock(items) {
  for (const item of items) {
    const product =
      db.products.find(p => p.id === item.productId);

    if (!product) {
      toast(`${item.name} no longer exists.`);
      return false;
    }

    if (Number(product.stock) < Number(item.qty)) {
      toast(`Not enough stock for ${product.name}.`);
      return false;
    }
  }

  return true;
}

function finishSale(data) {
  data.items.forEach(item => {
    const product =
      db.products.find(p => p.id === item.productId);

    product.stock -= Number(item.qty);
  });

  const invoice =
    "STK-" +
    Date.now().toString().slice(-7);

  const sale = {
    id: id(),
    invoice,
    date: new Date().toLocaleString(),
    ...data
  };

  db.sales.unshift(sale);

  addActivity(
    `Sale completed: ${invoice} for ${money(data.total)}`
  );

  if (
    data.customer &&
    data.customer !== "Walk-in Customer" &&
    data.customer !== "Bill Scan Customer"
  ) {
    let customer =
      db.customers.find(customer =>
        customer.phone &&
        customer.phone === data.phone
      );

    if (!customer && data.phone) {
      customer = {
        id: id(),
        name: data.customer,
        phone: data.phone,
        email: "",
        createdAt: new Date().toLocaleString()
      };

      db.customers.push(customer);
    }
  }

  saveData();

  return sale;
}

/* =========================
   RESTOCK
========================= */

function restock() {
  const productId =
    document.getElementById("restockProduct").value;

  const qty =
    Number(document.getElementById("restockQty").value);

  if (!productId || !qty || qty <= 0) {
    toast("Select a product and quantity.");
    return;
  }

  const product =
    db.products.find(p => p.id === productId);

  product.stock += qty;

  const record = {
    id: id(),
    product: product.name,
    qty,
    cost:
      Number(document.getElementById("restockCost").value || 0),
    supplier:
      document.getElementById("restockSupplier").value,
    notes:
      document.getElementById("restockNotes").value,
    date: new Date().toLocaleString()
  };

  db.restocks.unshift(record);

  addActivity(`Restocked ${product.name}: +${qty} units`);

  document.getElementById("restockQty").value = "";
  document.getElementById("restockCost").value = "";
  document.getElementById("restockNotes").value = "";

  saveData();

  toast("Stock added successfully!");
}

function renderRestocks() {
  const container =
    document.getElementById("restockHistory");

  if (!db.restocks.length) {
    container.innerHTML =
      `<div class="activity">No restock history yet.</div>`;
    return;
  }

  container.innerHTML =
    db.restocks.slice(0, 10).map(record => `
      <div class="activity">
        <b>${escapeHTML(record.product)}</b>
        <br>
        +${record.qty} units
        <br>
        <small>${record.date}</small>
      </div>
    `).join("");
}

/* =========================
   EXPENSES
========================= */

function addExpense() {
  const name =
    document.getElementById("expenseName").value.trim();

  const amount =
    Number(document.getElementById("expenseAmount").value);

  if (!name || !amount || amount <= 0) {
    toast("Enter an expense name and amount.");
    return;
  }

  db.expenses.unshift({
    id: id(),
    name,
    category:
      document.getElementById("expenseCategory").value,
    amount,
    date:
      document.getElementById("expenseDate").value ||
      new Date().toISOString().slice(0, 10)
  });

  addActivity(`Expense added: ${name} (${money(amount)})`);

  document.getElementById("expenseName").value = "";
  document.getElementById("expenseAmount").value = "";

  saveData();

  toast("Expense saved!");
}

function renderExpenses() {
  document.getElementById("expenseTotal").textContent =
    money(getExpenses());

  const container =
    document.getElementById("expenseList");

  if (!db.expenses.length) {
    container.innerHTML =
      `<div class="activity">No expenses recorded yet.</div>`;
    return;
  }

  container.innerHTML =
    db.expenses.map(expense => `
      <div class="list-row">
        <b>${escapeHTML(expense.name)}</b>
        <br>
        <small>
          ${escapeHTML(expense.category)} · ${expense.date}
        </small>
        <span style="float:right;color:#ff8888">
          ${money(expense.amount)}
        </span>
      </div>
    `).join("");
}

/* =========================
   SALES HISTORY
========================= */

function renderSales() {
  const container =
    document.getElementById("salesTable");

  if (!db.sales.length) {
    container.innerHTML = `
      <tr>
        <td colspan="6">No sales yet.</td>
      </tr>
    `;
    return;
  }

  container.innerHTML =
    db.sales.map(sale => `
      <tr>
        <td>${sale.invoice}</td>
        <td>${sale.date}</td>
        <td>${escapeHTML(sale.customer)}</td>
        <td>${sale.items.length}</td>
        <td>${escapeHTML(sale.payment)}</td>
        <td>${money(sale.total)}</td>
      </tr>
    `).join("");
}

/* =========================
   CUSTOMERS
========================= */

function addCustomer() {
  const name =
    document.getElementById("customerName").value.trim();

  if (!name) {
    toast("Enter customer name.");
    return;
  }

  db.customers.push({
    id: id(),
    name,
    phone:
      document.getElementById("customerPhone").value.trim(),
    email:
      document.getElementById("customerEmail").value.trim(),
    createdAt: new Date().toLocaleString()
  });

  document.getElementById("customerName").value = "";
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerEmail").value = "";

  saveData();

  toast("Customer added!");
}

function renderCustomers() {
  const container =
    document.getElementById("customerList");

  if (!db.customers.length) {
    container.innerHTML =
      `<div class="panel">No customers added yet.</div>`;
    return;
  }

  container.innerHTML =
    db.customers.map(customer => `
      <div class="management-card">
        <h3>${escapeHTML(customer.name)}</h3>
        <p>📞 ${escapeHTML(customer.phone || "No phone")}</p>
        <p>✉ ${escapeHTML(customer.email || "No email")}</p>
        <button onclick="deleteCustomer('${customer.id}')">
          Delete
        </button>
      </div>
    `).join("");
}

function deleteCustomer(customerId) {
  db.customers =
    db.customers.filter(customer => customer.id !== customerId);

  saveData();
}

/* =========================
   SUPPLIERS
========================= */

function addSupplier() {
  const name =
    document.getElementById("supplierName").value.trim();

  if (!name) {
    toast("Enter supplier name.");
    return;
  }

  db.suppliers.push({
    id: id(),
    name,
    company:
      document.getElementById("supplierCompany").value.trim(),
    phone:
      document.getElementById("supplierPhone").value.trim(),
    email:
      document.getElementById("supplierEmail").value.trim()
  });

  document.getElementById("supplierName").value = "";
  document.getElementById("supplierCompany").value = "";
  document.getElementById("supplierPhone").value = "";
  document.getElementById("supplierEmail").value = "";

  saveData();

  toast("Supplier added!");
}

function renderSuppliers() {
  const container =
    document.getElementById("supplierList");

  if (!db.suppliers.length) {
    container.innerHTML =
      `<div class="panel">No suppliers added yet.</div>`;
    return;
  }

  container.innerHTML =
    db.suppliers.map(supplier => `
      <div class="management-card">
        <h3>${escapeHTML(supplier.name)}</h3>
        <p>${escapeHTML(supplier.company || "")}</p>
        <p>📞 ${escapeHTML(supplier.phone || "No phone")}</p>
        <p>✉ ${escapeHTML(supplier.email || "No email")}</p>
        <button onclick="deleteSupplier('${supplier.id}')">
          Delete
        </button>
      </div>
    `).join("");
}

function deleteSupplier(supplierId) {
  db.suppliers =
    db.suppliers.filter(supplier => supplier.id !== supplierId);

  saveData();
}

/* =========================
   SELECT OPTIONS
========================= */

function updateSelects() {
  const supplierOptions = `
    <option value="">No Supplier</option>
    ${db.suppliers.map(supplier => `
      <option value="${escapeHTML(supplier.name)}">
        ${escapeHTML(supplier.name)}
      </option>
    `).join("")}
  `;

  document.getElementById("pSupplier").innerHTML =
    supplierOptions;

  document.getElementById("restockSupplier").innerHTML =
    supplierOptions;

  document.getElementById("restockProduct").innerHTML =
    productOptions();
}

/* =========================
   ANALYTICS
========================= */

function renderAnalytics() {
  const inventoryValue =
    db.products.reduce(
      (sum, product) =>
        sum +
        Number(product.stock) *
        Number(product.cost || product.price || 0),
      0
    );

  document.getElementById("aRevenue").textContent =
    money(getRevenue());

  document.getElementById("aInventory").textContent =
    money(inventoryValue);

  document.getElementById("aExpenses").textContent =
    money(getExpenses());

  document.getElementById("aProfit").textContent =
    money(getNetProfit());

  const top =
    getTopProductData().slice(0, 8);

  document.getElementById("analyticsProducts").innerHTML =
    top.length
      ? top.map(([name, data]) => `
          <div class="list-row">
            <b>${escapeHTML(name)}</b>
            <span style="float:right;color:var(--green)">
              ${data.qty} sold
            </span>
          </div>
        `).join("")
      : `<div class="activity">No sales data yet.</div>`;

  const payments = {};

  db.sales.forEach(sale => {
    payments[sale.payment] =
      (payments[sale.payment] || 0) +
      Number(sale.total);
  });

  document.getElementById("paymentStats").innerHTML =
    Object.keys(payments).length
      ? Object.entries(payments).map(([name, amount]) => `
          <div class="list-row">
            <b>${escapeHTML(name)}</b>
            <span style="float:right;color:var(--green)">
              ${money(amount)}
            </span>
          </div>
        `).join("")
      : `<div class="activity">No payment data yet.</div>`;
}

/* =========================
   SETTINGS
========================= */

function loadSettings() {
  document.getElementById("businessName").value =
    db.settings.businessName || "";

  document.getElementById("businessAddress").value =
    db.settings.address || "";

  document.getElementById("businessPhone").value =
    db.settings.phone || "";

  document.getElementById("topBusinessName").textContent =
    db.settings.businessName || "My Business";
}

function saveSettings() {
  db.settings.businessName =
    document.getElementById("businessName").value.trim() ||
    "My Business";

  db.settings.address =
    document.getElementById("businessAddress").value.trim();

  db.settings.phone =
    document.getElementById("businessPhone").value.trim();

  saveData();

  toast("Business settings saved!");
}

/* =========================
   REPORT DOWNLOADS
========================= */

function downloadReport(type) {
  let rows = [];
  let filename = "";

  if (type === "inventory") {
    rows = [
      ["Product", "Category", "Stock", "Cost", "Price"]
    ];

    db.products.forEach(product => {
      rows.push([
        product.name,
        product.category,
        product.stock,
        product.cost,
        product.price
      ]);
    });

    filename = "stockora-inventory.csv";
  }

  if (type === "sales") {
    rows = [
      ["Invoice", "Date", "Customer", "Payment", "Total"]
    ];

    db.sales.forEach(sale => {
      rows.push([
        sale.invoice,
        sale.date,
        sale.customer,
        sale.payment,
        sale.total
      ]);
    });

    filename = "stockora-sales.csv";
  }

  if (type === "expenses") {
    rows = [
      ["Name", "Category", "Amount", "Date"]
    ];

    db.expenses.forEach(expense => {
      rows.push([
        expense.name,
        expense.category,
        expense.amount,
        expense.date
      ]);
    });

    filename = "stockora-expenses.csv";
  }

  const csv =
    rows.map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");

  downloadFile(csv, filename, "text/csv");

  toast("Report downloaded!");
}

/* =========================
   BACKUP
========================= */

function exportData() {
  downloadFile(
    JSON.stringify(db, null, 2),
    "stockora-backup.json",
    "application/json"
  );

  toast("Full backup downloaded!");
}

function importData(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);

      if (!imported || typeof imported !== "object") {
        throw new Error("Invalid file");
      }

      if (!confirm("Replace current STOCKORA data?")) {
        return;
      }

      db = imported;

      saveData();

      toast("Backup restored successfully!");

    } catch (error) {
      toast("This backup file is invalid.");
    }
  };

  reader.readAsText(file);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

function resetData() {
  if (
    !confirm(
      "Are you sure? This will permanently remove all STOCKORA data from this device."
    )
  ) {
    return;
  }

  localStorage.removeItem(DB_KEY);

  location.reload();
}

/* =========================
   SEARCH + ALERTS
========================= */

function globalSearch() {
  const value =
    document.getElementById("globalSearch").value.trim();

  if (!value) return;

  openPage("inventory");

  document.getElementById("inventorySearch").value =
    value;

  renderInventory();
}

function showAlerts() {
  const low =
    db.products.filter(product =>
      Number(product.stock) <= Number(product.min || 5)
    );

  if (!low.length) {
    toast("No low-stock alerts!");
    return;
  }

  openPage("inventory");

  document.getElementById("inventoryFilter").value =
    "low";

  renderInventory();

  toast(`${low.length} product(s) need attention.`);
}

/* =========================
   SECURITY HELPER
========================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   REFRESH EVERYTHING
========================= */

function refreshAll() {
  updateDashboard();
  renderInventory();
  renderPOSProducts();
  renderCart();
  renderRestocks();
  renderExpenses();
  renderSales();
  renderCustomers();
  renderSuppliers();
  updateSelects();
  renderAnalytics();
  loadSettings();
}

/* =========================
   START APP
========================= */

loadData();

refreshAll();

document.getElementById("expenseDate").value =
  new Date().toISOString().slice(0, 10);

selectScanner(1);
