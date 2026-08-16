const API_URL = "https://script.google.com/macros/s/AKfycbzEWadNGyMnFZu_DZLAeRqn395nOcR-24DsEZxlXYmdlZpFhCG2BPY1U5JBgp64SLiFWw/exec";

let allProducts = [];
let posCart = [];
let currentProductToCustomize = null;

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

    // Control del Ticket en Móvil
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

    // Botones de acción principales
    document.getElementById('btnCobrar').addEventListener('click', processPosSale);
    
    // Modal de Historial
    document.getElementById('btnOpenHistory').addEventListener('click', openHistoryModal);
    document.getElementById('btnCloseHistory').addEventListener('click', closeHistoryModal);
    document.getElementById('historyModalOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('historyModalOverlay')) closeHistoryModal();
    });

    // Modal de Personalización
    document.getElementById('closeCustomModal').addEventListener('click', closeCustomModal);
    document.getElementById('confirmCustomBtn').addEventListener('click', confirmCustomProduct);
    document.getElementById('posCustomModalOverlay').addEventListener('click', closeCustomModal);
}

// --- CARGA DE PRODUCTOS ---
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
            <div class="${cardClass}" onclick="openCustomPosModal('${p.id}', '${p.nombre}', ${p.precio}, ${isAgotado}, '${p.categoria}')">
                <div>
                    ${imgTag}
                    <h4>${p.nombre}</h4>
                </div>
                <div>${agotadoText}</div>
            </div>
        `;
    });
}

// --- LÓGICA DE PERSONALIZACIÓN Y CARRITO ---
function openCustomPosModal(id, name, price, isAgotado, category) {
    if (isAgotado) return;

    if (category === 'Salsas' || category === 'Toppings') {
        addToPosCart(id, name, price, "", "");
        return;
    }

    currentProductToCustomize = { id, name, price: parseFloat(price) };
    document.getElementById('modalProductName').textContent = name;
    document.querySelectorAll('#posCustomModal input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    document.getElementById('posCustomModalOverlay').classList.add('active');
    document.getElementById('posCustomModal').classList.add('active');
}

function closeCustomModal() {
    document.getElementById('posCustomModalOverlay').classList.remove('active');
    document.getElementById('posCustomModal').classList.remove('active');
}

function confirmCustomProduct() {
    if (!currentProductToCustomize) return;

    const selectedSalsas = Array.from(document.querySelectorAll('input[name="pos_salsa"]:checked')).map(cb => cb.value);
    const selectedToppings = Array.from(document.querySelectorAll('input[name="pos_topping"]:checked')).map(cb => cb.value);

    const salsasText = selectedSalsas.length > 0 ? selectedSalsas.join(', ') : '';
    const toppingsText = selectedToppings.length > 0 ? selectedToppings.join(', ') : '';

    addToPosCart(
        currentProductToCustomize.id, 
        currentProductToCustomize.name, 
        currentProductToCustomize.price, 
        salsasText, 
        toppingsText
    );

    closeCustomModal();
}

function addToPosCart(id, name, price, salsas, toppings) {
    const cartKey = `${id}-${salsas}-${toppings}`;
    const existing = posCart.find(item => item.cartKey === cartKey);
    
    if (existing) {
        existing.qty++;
    } else {
        posCart.push({ cartKey, id, name, price: parseFloat(price), qty: 1, salsas, toppings });
    }
    renderPosCart();
}

function updatePosQty(cartKey, delta) {
    const item = posCart.find(i => i.cartKey === cartKey);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
            posCart = posCart.filter(i => i.cartKey !== cartKey);
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

        let customText = "";
        if (item.salsas || item.toppings) {
            let sText = item.salsas ? `Salsas: ${item.salsas}` : "";
            let tText = item.toppings ? `Toppings: ${item.toppings}` : "";
            let separator = (sText && tText) ? " | " : "";
            customText = `<span class="pos-item-custom-text">${sText}${separator}${tText}</span>`;
        }

        container.innerHTML += `
            <div class="pos-cart-item">
                <div class="pos-item-info">
                    <h5>${item.name}</h5>
                    <span>$${item.price.toFixed(2)} x ${item.qty}</span>
                    ${customText}
                </div>
                <div class="pos-item-actions">
                    <button onclick="updatePosQty('${item.cartKey}', -1)">-</button>
                    <strong>${item.qty}</strong>
                    <button onclick="updatePosQty('${item.cartKey}', 1)">+</button>
                </div>
            </div>
        `;
    });

    document.getElementById('posCartTotal').textContent = total.toFixed(2);
    document.getElementById('posItemCount').textContent = `${count} items`;
}

// --- PROCESAR VENTA ---
async function processPosSale() {
    if (posCart.length === 0) {
        showToast('El ticket está vacío', 'error');
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    let total = 0;
    let detailsSummary = "";

    posCart.forEach(item => {
        total += (item.price * item.qty);
        let customInfo = (item.salsas || item.toppings) ? ` (Salsas: ${item.salsas || 'No'} | Toppings: ${item.toppings || 'No'})` : "";
        detailsSummary += `${item.qty}x ${item.name}${customInfo}, `;
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
            showToast(`¡Venta registrada con éxito por $${total.toFixed(2)}!`, 'success');
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

// --- HISTORIAL DE VENTAS Y ELIMINACIÓN/CANCELACIÓN ---
async function openHistoryModal() {
    document.getElementById('historyModalOverlay').classList.add('active');
    await fetchSalesHistory();
}

function closeHistoryModal() {
    document.getElementById('historyModalOverlay').classList.remove('active');
}

async function fetchSalesHistory() {
    const tbody = document.getElementById('tbHistorySales');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#b2bec3; padding:30px;">Cargando historial...</td></tr>`;
    
    try {
        const res = await fetch(`${API_URL}?action=getFinances`);
        const data = await res.json();
        
        const sales = data.filter(row => row.tipo === 'Ingreso');
        
        if (sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#b2bec3; padding:30px;">No hay ventas registradas aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        sales.reverse().forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td style="white-space:nowrap; color:#888; font-size:0.85rem;">${row.fecha || 'N/A'}</td>
                    <td style="line-height:1.4;">${row.detalle}</td>
                    <td style="font-weight:bold; color:var(--primary-dark);">$${parseFloat(row.monto).toFixed(2)}</td>
                    <td>
                        <button class="btn-delete-sale" onclick="deleteSale('${row.id}')" title="Cancelar Venta">
                            <i class="fas fa-ban"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#e74c3c; padding:30px;">Error al cargar el historial.</td></tr>`;
    }
}

async function deleteSale(financeId) {
    if(!confirm("¿Estás seguro de cancelar esta venta? Desaparecerá de tu historial pero quedará registrada como cancelación en el sistema.")) return;
    
    showLoader();
    try {
        const payload = {
            action: "cancelFinance", // Ahora usamos la nueva acción
            id: financeId
        };

        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === "success") {
            showToast('Venta cancelada correctamente', 'success');
            await fetchSalesHistory(); 
        } else {
            showToast('Error al cancelar la venta', 'error');
        }
    } catch (err) {
        showToast('Error de conexión con el servidor', 'error');
    }
    hideLoader();
}

// --- UTILIDADES ---
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
