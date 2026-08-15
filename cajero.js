const API_URL = "https://script.google.com/macros/s/AKfycbzEWadNGyMnFZu_DZLAeRqn395nOcR-24DsEZxlXYmdlZpFhCG2BPY1U5JBgp64SLiFWw/exec";

let allProducts = [];
let posCart = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchPosProducts();
    setupPosListeners();
});

function setupPosListeners() {
    // Categorías
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderPosMenu(e.target.dataset.cat);
            document.getElementById('searchPosInput').value = "";
        });
    });

    document.querySelector('.cart-title').addEventListener('click', () => {
    if (window.innerWidth <= 992) {
        document.querySelector('.pos-cart-section').classList.toggle('mobile-open');
    }
});

    // Buscador
    document.getElementById('searchPosInput').addEventListener('input', (e) => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        const term = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p => p.nombre.toLowerCase().includes(term));
        renderPosGrid(filtered);
    });

    // Botón Cobrar
    document.getElementById('btnCobrar').addEventListener('click', processPosSale);
}

async function fetchPosProducts() {
    showLoader();
    try {
        const res = await fetch(`${API_URL}?action=getProducts`);
        allProducts = await res.json();
        renderPosMenu('Todos');
    } catch (error) {
        showToast('Error al cargar productos del catálogo', 'error');
    }
    hideLoader();
}

function renderPosMenu(category) {
    const filtered = category === 'Todos' ? allProducts : allProducts.filter(p => p.categoria === category);
    renderPosGrid(filtered);
}

function renderPosGrid(products) {
    const container = document.getElementById('posMenuContainer');
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#b2bec3; margin-top:40px;">No hay productos disponibles.</p>`;
        return;
    }

    products.forEach(p => {
        const isAgotado = p.estado === 'Agotado';
        const cardClass = isAgotado ? 'pos-card agotado' : 'pos-card';
        const imgTag = p.imagen ? `<img src="${p.imagen}" class="pos-card-img" alt="${p.nombre}">` : `<div class="pos-card-img" style="display:flex; align-items:center; justify-content:center; color:#ccc;"><i class="fas fa-image"></i></div>`;
        const agotadoText = isAgotado ? `<small style="color:#d63031; font-weight:bold;">Agotado</small>` : `<span class="price">$${parseFloat(p.precio).toFixed(2)}</span>`;

        container.innerHTML += `
            <div class="${cardClass}" onclick="addPosItem('${p.id}', '${p.nombre}', ${p.precio}, ${isAgotado})">
                <div>
                    ${imgTag}
                    <h4>${p.nombre}</h4>
                </div>
                <div>${agotadoText}</div>
            </div>
        `;
    });
}

function addPosItem(id, name, price, isAgotado) {
    if (isAgotado) return;

    const existing = posCart.find(item => item.id === id);
    if (existing) {
        existing.qty++;
    } else {
        posCart.push({ id, name, price: parseFloat(price), qty: 1 });
    }
    renderPosCart();
}

function updatePosQty(id, delta) {
    const item = posCart.find(i => i.id === id);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
            posCart = posCart.filter(i => i.id !== id);
        }
        renderPosCart();
    }
}

function renderPosCart() {
    const container = document.getElementById('posCartItems');
    let total = 0;
    let count = 0;

    if (posCart.length === 0) {
        container.innerHTML = `
            <div class="empty-pos-cart">
                <i class="fas fa-shopping-cart"></i>
                <p>No hay productos en el ticket</p>
            </div>`;
        document.getElementById('posCartTotal').textContent = "0.00";
        document.getElementById('posItemCount').textContent = "0 items";
        return;
    }

    container.innerHTML = "";
    posCart.forEach(item => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        count += item.qty;

        container.innerHTML += `
            <div class="pos-cart-item">
                <div class="pos-item-info">
                    <h5>${item.name}</h5>
                    <span>$${item.price.toFixed(2)} x ${item.qty}</span>
                </div>
                <div class="pos-item-actions">
                    <button onclick="updatePosQty('${item.id}', -1)">-</button>
                    <strong>${item.qty}</strong>
                    <button onclick="updatePosQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `;
    });

    document.getElementById('posCartTotal').textContent = total.toFixed(2);
    document.getElementById('posItemCount').textContent = `${count} items`;
}

async function processPosSale() {
    if (posCart.length === 0) {
        showToast('El ticket está vacío', 'error');
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    let total = posCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    let detailsSummary = "";

    posCart.forEach(item => {
        detailsSummary += `${item.qty}x ${item.name}, `;
    });
    detailsSummary = detailsSummary.slice(0, -2);

    showLoader();

    try {
        const payload = {
            action: "addFinance",
            tipo: "Ingreso",
            monto: total,
            detalle: `Venta Local (${paymentMethod}): ${detailsSummary}`
        };

        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === "success") {
            showToast(`¡Venta registrada con éxito por $${total.toFixed(2)} (${paymentMethod})!`, 'success');
            posCart = [];
            renderPosCart();
        } else {
            showToast('Error al registrar la venta', 'error');
        }
    } catch (err) {
        showToast('Error de conexión con el servidor', 'error');
    }

    hideLoader();
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? '#27ae60' : '#c13a30';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showLoader() { document.getElementById('loader').style.display = 'flex'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }

// --- FUNCIONES DE HISTORIAL DE VENTAS ---
document.getElementById('btnOpenHistory').addEventListener('click', openHistoryModal);
document.getElementById('btnCloseHistory').addEventListener('click', closeHistoryModal);
document.getElementById('historyModalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('historyModalOverlay')) {
        closeHistoryModal();
    }
});

async function openHistoryModal() {
    document.getElementById('historyModalOverlay').classList.add('active');
    await fetchSalesHistory();
}

function closeHistoryModal() {
    document.getElementById('historyModalOverlay').classList.remove('active');
}

async function fetchSalesHistory() {
    const tbody = document.getElementById('tbHistorySales');
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#b2bec3; padding:30px;">Cargando historial...</td></tr>`;
    
    try {
        const res = await fetch(`${API_URL}?action=getFinances`);
        const data = await res.json();
        
        // Filtramos sólo los ingresos registrados para mostrarlos en el historial de ventas
        const sales = data.filter(row => row.tipo === 'Ingreso');
        
        if (sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#b2bec3; padding:30px;">No hay ventas registradas aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        sales.reverse().forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td style="white-space:nowrap; color:#888; font-size:0.85rem;">${row.fecha || 'N/A'}</td>
                    <td>${row.detalle || 'Venta general'}</td>
                    <td style="font-weight:bold; color:var(--primary-dark);">$${parseFloat(row.monto).toFixed(2)}</td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#e74c3c; padding:30px;">Error al cargar el historial.</td></tr>`;
    }
}