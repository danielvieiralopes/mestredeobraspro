const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const getID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const initialServices = [
    { id: 1, desc: 'Diária Pedreiro', unit: 'dia', value: 200.00 },
    { id: 2, desc: 'Diária Servente', unit: 'dia', value: 120.00 },
    { id: 3, desc: 'Reboco', unit: 'm²', value: 35.00 },
    { id: 4, desc: 'Pintura', unit: 'm²', value: 25.00 },
    { id: 5, desc: 'Assentamento Piso', unit: 'm²', value: 60.00 }
];

let state = {
    services: JSON.parse(localStorage.getItem('obras_services')) || initialServices,
    savedBudgets: JSON.parse(localStorage.getItem('obras_budgets')) || [],
    financials: JSON.parse(localStorage.getItem('obras_financials')) || [],
    workers: JSON.parse(localStorage.getItem('obras_workers')) || [],
    workLogs: JSON.parse(localStorage.getItem('obras_workLogs')) || [],
    vales: JSON.parse(localStorage.getItem('obras_vales')) || []
};

let currentBudgetItems = [];

window.switchTab = (tabName) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-gray-400');
    });
    
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-blue-600');
    }

    if(tabName === 'historico') renderSavedBudgets();
    if(tabName === 'gestao') { renderFinancials(); renderWorkers(); }
};

const saveData = () => {
    localStorage.setItem('obras_services', JSON.stringify(state.services));
    localStorage.setItem('obras_budgets', JSON.stringify(state.savedBudgets));
    localStorage.setItem('obras_financials', JSON.stringify(state.financials));
    localStorage.setItem('obras_workers', JSON.stringify(state.workers));
    localStorage.setItem('obras_workLogs', JSON.stringify(state.workLogs));
    localStorage.setItem('obras_vales', JSON.stringify(state.vales));
};

const renderServices = () => {
    const container = document.getElementById('service-list-container');
    const select = document.getElementById('budget-service-select');
    
    container.innerHTML = '';
    select.innerHTML = '<option value="">Selecione um serviço...</option>';

    state.services.forEach(s => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-2 border rounded text-xs';
        div.innerHTML = `
            <span><strong>${s.desc}</strong> (${formatMoney(s.value)}/${s.unit})</span>
            <button onclick="deleteService(${s.id})" class="text-red-500 font-bold px-2">×</button>
        `;
        container.appendChild(div);

        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = `${s.desc} - ${formatMoney(s.value)}`;
        select.appendChild(opt);
    });
};

const renderCurrentBudget = () => {
    const list = document.getElementById('budget-items-list');
    const totalEl = document.getElementById('budget-total');
    list.innerHTML = '';
    
    let total = 0;

    if (currentBudgetItems.length === 0) {
        list.innerHTML = '<li class="py-4 text-center text-gray-400 italic text-xs">Nenhum item lançado.</li>';
    }

    currentBudgetItems.forEach((item, idx) => {
        const s = state.services.find(serv => serv.id == item.serviceId);
        if(!s) return;
        const subtotal = item.qty * s.value;
        total += subtotal;

        const li = document.createElement('li');
        li.className = 'flex justify-between items-center py-2 border-b border-gray-50';
        li.innerHTML = `
            <div>
                <div class="font-bold text-gray-700">${s.desc}</div>
                <div class="text-xs text-gray-500">${item.qty} ${s.unit} x ${formatMoney(s.value)}</div>
            </div>
            <div class="flex items-center">
                <span class="font-bold text-gray-900 mr-3">${formatMoney(subtotal)}</span>
                <button onclick="removeItem(${idx})" class="text-red-400 text-xs">🗑️</button>
            </div>
        `;
        list.appendChild(li);
    });

    totalEl.innerText = formatMoney(total);
};

document.getElementById('btn-reset-app').addEventListener('click', () => {
    if(confirm('Limpar todos os dados do app?')) { 
        localStorage.clear(); 
        location.reload(); 
    }
});

document.getElementById('form-add-service').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('service-desc').value;
    const unit = document.getElementById('service-unit').value;
    const value = parseFloat(document.getElementById('service-value').value);
    
    state.services.push({ id: Date.now(), desc, unit, value });
    saveData();
    renderServices();
    e.target.reset();
});

window.deleteService = (id) => {
    if(confirm('Apagar serviço?')) {
        state.services = state.services.filter(s => s.id !== id);
        saveData();
        renderServices();
    }
};

document.getElementById('form-add-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const serviceId = document.getElementById('budget-service-select').value;
    const qty = parseFloat(document.getElementById('budget-item-qty').value);
    
    if(!serviceId || !qty) return;

    currentBudgetItems.push({ serviceId, qty });
    renderCurrentBudget();
    document.getElementById('budget-item-qty').value = '';
});

window.removeItem = (idx) => {
    currentBudgetItems.splice(idx, 1);
    renderCurrentBudget();
};

document.getElementById('btn-clear-current').addEventListener('click', () => {
    if(confirm('Limpar itens da tela?')) {
        currentBudgetItems = [];
        document.getElementById('client-name').value = '';
        document.getElementById('client-project').value = '';
        renderCurrentBudget();
    }
});

document.getElementById('btn-save-budget').addEventListener('click', () => {
    if(currentBudgetItems.length === 0) return alert('Orçamento vazio!');
    const client = document.getElementById('client-name').value || 'Cliente s/ nome';
    const project = document.getElementById('client-project').value || 'Obra';
    
    let total = 0;
    const itemsToSave = currentBudgetItems.map(item => {
        const s = state.services.find(serv => serv.id == item.serviceId);
        if(s) total += (item.qty * s.value);
        return { ...item, desc: s ? s.desc : '?', unit: s ? s.unit : '', value: s ? s.value : 0 };
    });

    state.savedBudgets.unshift({
        id: getID(),
        date: new Date().toLocaleDateString('pt-BR'),
        client,
        project,
        items: itemsToSave,
        total
    });
    saveData();
    alert('Orçamento salvo no Histórico! 📂');
});

document.getElementById('btn-whatsapp').addEventListener('click', () => {
    if(currentBudgetItems.length === 0) return alert('Adicione itens ao orçamento!');
    
    const client = document.getElementById('client-name').value || 'Cliente';
    const project = document.getElementById('client-project').value || 'Obra';
    const intro = document.getElementById('msg-intro').value;
    const footer = document.getElementById('msg-footer').value;
    const date = new Date().toLocaleDateString('pt-BR');

    let msg = `*🏗 ORÇAMENTO DE OBRA 🏗*\n\n`;
    if(intro) msg += `${intro}\n\n`;
    
    msg += `👤 Cliente: ${client}\n`;
    msg += `🏠 Obra: ${project}\n`;
    msg += `📅 Data: ${date}\n\n`;
    msg += `📋 DETALHAMENTO DOS SERVIÇOS:\n\n`;
    
    let total = 0;
    currentBudgetItems.forEach(item => {
        const s = state.services.find(serv => serv.id == item.serviceId);
        if(s) {
            const sub = item.qty * s.value;
            total += sub;
            msg += `🔸 ${s.desc}\n`;
            msg += `   ${item.qty} ${s.unit} x ${formatMoney(s.value)}\n`;
            msg += `   Subtotal: ${formatMoney(sub)}\n\n`;
        }
    });

    msg += `─────────────────────\n`;
    msg += `💰 *VALOR TOTAL: ${formatMoney(total)}*\n`;
    msg += `─────────────────────\n\n`;
    if(footer) msg += `${footer}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
});

const renderSavedBudgets = () => {
    const container = document.getElementById('saved-budgets-list');
    container.innerHTML = '';

    if(state.savedBudgets.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 mt-10">Nenhum orçamento salvo ainda.</p>';
        return;
    }

    state.savedBudgets.forEach(b => {
        const card = document.createElement('div');
        card.className = 'card p-3 border-l-4 border-gray-400';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-gray-800">${b.client}</h3>
                    <p class="text-xs text-gray-500">${b.project} • ${b.date}</p>
                </div>
                <div class="text-right">
                    <span class="block font-bold text-green-700">${formatMoney(b.total)}</span>
                    <button onclick="deleteSavedBudget('${b.id}')" class="text-xs text-red-400 mt-1 underline">Excluir</button>
                </div>
            </div>
            <div class="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                ${b.items.length} itens. 
                <button onclick="loadBudgetToEdit('${b.id}')" class="text-blue-600 font-bold ml-2">Carregar na Tela Inicial</button>
            </div>
        `;
        container.appendChild(card);
    });
};

window.deleteSavedBudget = (id) => {
    if(confirm('Excluir este orçamento do histórico?')) {
        state.savedBudgets = state.savedBudgets.filter(b => b.id !== id);
        saveData();
        renderSavedBudgets();
    }
};

window.loadBudgetToEdit = (id) => {
    const b = state.savedBudgets.find(item => item.id === id);
    if(b) {
        if(confirm('Isso vai substituir o que está na tela de orçamento atual. Continuar?')) {
            document.getElementById('client-name').value = b.client;
            document.getElementById('client-project').value = b.project;
            
            currentBudgetItems = b.items.map(savedItem => {
                let existingService = state.services.find(s => s.desc === savedItem.desc);
                if(!existingService) {
                    existingService = { id: Date.now() + Math.random(), desc: savedItem.desc, unit: savedItem.unit, value: savedItem.value };
                    state.services.push(existingService);
                }
                return { serviceId: existingService.id, qty: savedItem.qty };
            });
            
            saveData();
            renderServices();
            renderCurrentBudget();
            switchTab('orcamento');
        }
    }
};

const renderFinancials = () => {
    const list = document.getElementById('fin-list');
    list.innerHTML = '';
    
    let totalIn = 0;
    let totalOut = 0;

    state.financials.forEach((f, idx) => {
        if(f.type === 'in') totalIn += f.val;
        else totalOut += f.val;

        const li = document.createElement('li');
        li.className = 'py-2 flex justify-between items-center';
        li.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2 text-base">${f.type === 'in' ? '🟢' : '🔴'}</span>
                <div>
                    <span class="block font-medium text-gray-700">${f.desc}</span>
                    <span class="text-[10px] text-gray-400">${f.date}</span>
                </div>
            </div>
            <div class="flex items-center">
                <span class="font-bold mr-2 ${f.type === 'in' ? 'text-green-600' : 'text-red-600'}">
                    ${f.type === 'in' ? '+' : '-'} ${formatMoney(f.val)}
                </span>
                <button onclick="deleteFin(${idx})" class="text-gray-300 hover:text-red-500">×</button>
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById('fin-in').innerText = formatMoney(totalIn);
    document.getElementById('fin-out').innerText = formatMoney(totalOut);
    
    const bal = totalIn - totalOut;
    const balEl = document.getElementById('fin-balance');
    balEl.innerText = formatMoney(bal);
    balEl.className = `font-bold text-sm ${bal >= 0 ? 'text-blue-600' : 'text-red-600'}`;
};

document.getElementById('form-add-fin').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('fin-type').value;
    const desc = document.getElementById('fin-desc').value;
    const val = parseFloat(document.getElementById('fin-val').value);
    
    state.financials.unshift({
        id: getID(),
        type, desc, val,
        date: new Date().toLocaleDateString('pt-BR')
    });
    saveData();
    renderFinancials();
    document.getElementById('fin-desc').value = '';
    document.getElementById('fin-val').value = '';
});

window.deleteFin = (idx) => {
    if(confirm('Apagar registro?')) {
        state.financials.splice(idx, 1);
        saveData();
        renderFinancials();
    }
};

const renderWorkers = () => {
    const container = document.getElementById('workers-list');
    container.innerHTML = '';

    state.workers.forEach(w => {
        const days = state.workLogs.filter(l => l.workerId === w.id).length;
        const totalDue = days * w.rate;
        const vales = state.vales.filter(v => v.workerId === w.id);
        const totalVales = vales.reduce((acc, v) => acc + v.value, 0);
        const toPay = totalDue - totalVales;

        const card = document.createElement('div');
        card.className = 'bg-white border rounded p-3 shadow-sm';
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-gray-800">${w.name}</h4>
                <div class="flex items-center space-x-2">
                    <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Diária: ${formatMoney(w.rate)}</span>
                    <button onclick="deleteWorker('${w.id}')" class="text-red-300 hover:text-red-500 text-xs">🗑️</button>
                </div>
            </div>
            
            <div class="bg-gray-50 p-2 rounded text-sm mb-2 space-y-1 border border-gray-100">
                <div class="flex justify-between text-gray-600">
                    <span>🗓️ Bruto (${days} dias)</span>
                    <span class="font-medium">${formatMoney(totalDue)}</span>
                </div>
                <div class="flex justify-between text-red-500">
                    <span>💸 Vales/Adiant.</span>
                    <span>- ${formatMoney(totalVales)}</span>
                </div>
                <div class="flex justify-between border-t border-gray-200 pt-1 mt-1">
                    <span class="font-bold text-gray-800">Líquido a Pagar</span>
                    <span class="font-bold ${toPay >= 0 ? 'text-green-700' : 'text-red-600'}">${formatMoney(toPay)}</span>
                </div>
            </div>

            <div class="flex space-x-2 mb-2">
                <button onclick="addWorkDay('${w.id}')" class="flex-grow bg-blue-600 text-white py-2 rounded text-xs font-bold hover:bg-blue-700 flex items-center justify-center">
                    + Dia Trab.
                </button>
                <button onclick="addVale('${w.id}')" class="flex-grow bg-red-100 text-red-600 border border-red-200 py-2 rounded text-xs font-bold hover:bg-red-200 flex items-center justify-center">
                    - Dar Vale
                </button>
            </div>

            <details class="mt-1 border-t pt-1">
                <summary class="text-[10px] text-gray-400 cursor-pointer text-center">Ver dias e vales</summary>
                <div class="mt-2 text-xs grid grid-cols-2 gap-2">
                    <div>
                        <strong class="block text-gray-600 mb-1">Dias:</strong>
                        <ul class="text-gray-500 space-y-1">
                            ${state.workLogs.filter(l => l.workerId === w.id).map(l => `<li>• ${l.date}</li>`).join('') || '<li>Nenhum</li>'}
                        </ul>
                    </div>
                    <div>
                        <strong class="block text-red-500 mb-1">Vales:</strong>
                        <ul class="text-gray-500 space-y-1">
                            ${vales.map(v => `<li>• ${formatMoney(v.value)} <span class="text-[9px] text-gray-400">(${v.desc})</span></li>`).join('') || '<li>Nenhum</li>'}
                        </ul>
                    </div>
                </div>
            </details>
        `;
        container.appendChild(card);
    });
};

document.getElementById('form-add-worker').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('worker-name').value;
    const rate = parseFloat(document.getElementById('worker-rate').value);

    state.workers.push({ id: getID(), name, rate });
    saveData();
    renderWorkers();
    e.target.reset();
});

window.addWorkDay = (workerId) => {
    const today = new Date().toLocaleDateString('pt-BR');
    if(confirm(`Confirmar dia de trabalho para hoje (${today})?`)) {
        state.workLogs.push({ id: getID(), workerId, date: today });
        saveData();
        renderWorkers();
    }
};

window.addVale = (workerId) => {
    const valStr = prompt('Qual o valor do Vale? (R$)');
    if(!valStr) return;
    
    const val = parseFloat(valStr.replace(',', '.'));
    if(isNaN(val) || val <= 0) return alert('Valor inválido!');
    
    const desc = prompt('Descrição (opcional, ex: Almoço):') || 'Adiantamento';
    
    state.vales.push({
        id: getID(),
        workerId,
        value: val,
        desc,
        date: new Date().toLocaleDateString('pt-BR')
    });
    saveData();
    renderWorkers();
};

window.deleteWorker = (id) => {
    if(confirm('Remover este trabalhador e TODO o histórico (dias e vales)?')) {
        state.workers = state.workers.filter(w => w.id !== id);
        state.workLogs = state.workLogs.filter(l => l.workerId !== id);
        state.vales = state.vales.filter(v => v.workerId !== id);
        saveData();
        renderWorkers();
    }
};

renderServices();
renderCurrentBudget();