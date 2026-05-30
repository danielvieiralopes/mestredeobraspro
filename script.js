const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const getID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const STORAGE_KEYS = {
    services: 'obras_services',
    budgets: 'obras_budgets',
    financials: 'obras_financials',
    workers: 'obras_workers',
    workLogs: 'obras_workLogs',
    vales: 'obras_vales',
    currentDraft: 'obras_currentBudgetDraft',
    companyLogo: 'obras_companyLogo',
    messageSettings: 'obras_messageSettings'
};

const loadJSON = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const initialServices = [
    { id: 1, desc: 'Diária Pedreiro', unit: 'dia', value: 200.00 },
    { id: 2, desc: 'Diária Servente', unit: 'dia', value: 120.00 },
    { id: 3, desc: 'Reboco', unit: 'm²', value: 35.00 },
    { id: 4, desc: 'Pintura', unit: 'm²', value: 25.00 },
    { id: 5, desc: 'Assentamento Piso', unit: 'm²', value: 60.00 }
];

const defaultMessageSettings = {
    intro: 'Olá segue o orçamento conforme combinado!',
    footer: '⚠ Este orçamento refere-se apenas à mão de obra. Materiais não inclusos.\n✅ Válido por 15 dias.',
    hidePrices: false,
    sendMode: 'image'
};

let state = {
    services: loadJSON(STORAGE_KEYS.services, initialServices),
    savedBudgets: loadJSON(STORAGE_KEYS.budgets, []),
    financials: loadJSON(STORAGE_KEYS.financials, []),
    workers: loadJSON(STORAGE_KEYS.workers, []),
    workLogs: loadJSON(STORAGE_KEYS.workLogs, []),
    vales: loadJSON(STORAGE_KEYS.vales, []),
    companyLogo: localStorage.getItem(STORAGE_KEYS.companyLogo) || '',
    messageSettings: {
        ...defaultMessageSettings,
        ...loadJSON(STORAGE_KEYS.messageSettings, {})
    }
};

const budgetDraft = loadJSON(STORAGE_KEYS.currentDraft, { client: '', project: '', items: [] });
let currentBudgetItems = Array.isArray(budgetDraft.items) ? budgetDraft.items : [];

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
    localStorage.setItem(STORAGE_KEYS.services, JSON.stringify(state.services));
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(state.savedBudgets));
    localStorage.setItem(STORAGE_KEYS.financials, JSON.stringify(state.financials));
    localStorage.setItem(STORAGE_KEYS.workers, JSON.stringify(state.workers));
    localStorage.setItem(STORAGE_KEYS.workLogs, JSON.stringify(state.workLogs));
    localStorage.setItem(STORAGE_KEYS.vales, JSON.stringify(state.vales));
    localStorage.setItem(STORAGE_KEYS.messageSettings, JSON.stringify(state.messageSettings));
    if(state.companyLogo) localStorage.setItem(STORAGE_KEYS.companyLogo, state.companyLogo);
    else localStorage.removeItem(STORAGE_KEYS.companyLogo);
};

const renderMessageSettings = () => {
    const intro = document.getElementById('msg-intro');
    const footer = document.getElementById('msg-footer');
    const hidePrices = document.getElementById('hide-budget-prices');
    const sendMode = document.getElementById('budget-send-mode');

    if(intro) intro.value = state.messageSettings.intro || '';
    if(footer) footer.value = state.messageSettings.footer || '';
    if(hidePrices) hidePrices.checked = Boolean(state.messageSettings.hidePrices);
    if(sendMode) sendMode.value = state.messageSettings.sendMode || defaultMessageSettings.sendMode;
};

const persistMessageSettings = () => {
    state.messageSettings = {
        intro: document.getElementById('msg-intro')?.value || '',
        footer: document.getElementById('msg-footer')?.value || '',
        hidePrices: Boolean(document.getElementById('hide-budget-prices')?.checked),
        sendMode: document.getElementById('budget-send-mode')?.value || defaultMessageSettings.sendMode
    };
    saveData();
};

const renderCompanyLogo = () => {
    const preview = document.getElementById('company-logo-preview');
    const empty = document.getElementById('company-logo-empty');
    const removeBtn = document.getElementById('btn-remove-logo');

    if(!preview || !empty || !removeBtn) return;

    if(state.companyLogo) {
        preview.src = state.companyLogo;
        preview.classList.remove('hidden');
        empty.classList.add('hidden');
        removeBtn.classList.remove('hidden');
    } else {
        preview.removeAttribute('src');
        preview.classList.add('hidden');
        empty.classList.remove('hidden');
        removeBtn.classList.add('hidden');
    }
};

const resizeImageFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const maxSide = 900;
            const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * ratio));
            canvas.height = Math.max(1, Math.round(img.height * ratio));

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const loadImageFromDataURL = (dataURL) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataURL;
});

const dataURLToFile = (dataURL, filename) => {
    const [header, base64] = dataURL.split(',');
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for(let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], filename, { type: mime });
};

const canvasToFile = (canvas, filename) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
        if(!blob) {
            reject(new Error('Falha ao gerar imagem.'));
            return;
        }

        resolve(new File([blob], filename, { type: 'image/png' }));
    }, 'image/png', 0.95);
});

const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const drawJustifiedCanvasLine = (ctx, words, x, y, maxWidth, justify) => {
    if(!justify || words.length <= 1) {
        ctx.fillText(words.join(' '), x, y);
        return;
    }

    const wordsWidth = words.reduce((total, word) => total + ctx.measureText(word).width, 0);
    const spaceWidth = (maxWidth - wordsWidth) / (words.length - 1);
    let currentX = x;

    words.forEach((word, index) => {
        ctx.fillText(word, currentX, y);
        currentX += ctx.measureText(word).width + (index < words.length - 1 ? spaceWidth : 0);
    });
};

const wrapCanvasText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const paragraphs = String(text || '').split('\n');
    let currentY = y;

    paragraphs.forEach((paragraph) => {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        const wrappedLines = [];
        let builtLine = '';

        words.forEach((word) => {
            const testLine = builtLine ? `${builtLine} ${word}` : word;
            if(ctx.measureText(testLine).width > maxWidth && builtLine) {
                wrappedLines.push(builtLine.split(' '));
                builtLine = word;
            } else {
                builtLine = testLine;
            }
        });

        if(builtLine) wrappedLines.push(builtLine.split(' '));

        wrappedLines.forEach((lineWords, index) => {
            const isLastLine = index === wrappedLines.length - 1;
            const lineWidth = ctx.measureText(lineWords.join(' ')).width;
            const shouldJustify = !isLastLine && lineWidth > maxWidth * 0.55;

            drawJustifiedCanvasLine(ctx, lineWords, x, currentY, maxWidth, shouldJustify);
            currentY += lineHeight;
        });

        if(wrappedLines.length === 0) currentY += lineHeight;
    });

    return currentY;
};

const countWrappedCanvasLines = (ctx, text, maxWidth) => {
    return String(text || '').split('\n').reduce((total, paragraph) => {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        let builtLine = '';
        let lineCount = 0;

        words.forEach((word) => {
            const testLine = builtLine ? `${builtLine} ${word}` : word;
            if(ctx.measureText(testLine).width > maxWidth && builtLine) {
                lineCount++;
                builtLine = word;
            } else {
                builtLine = testLine;
            }
        });

        return total + (builtLine ? lineCount + 1 : 1);
    }, 0);
};

const fitCanvasText = (ctx, text, maxWidth) => {
    const value = String(text || '');
    if(ctx.measureText(value).width <= maxWidth) return value;

    let fitted = value;
    while(fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
        fitted = fitted.slice(0, -1);
    }

    return `${fitted}...`;
};

const getCurrentBudgetDetails = () => {
    let total = 0;
    const items = currentBudgetItems.map(item => {
        const service = state.services.find(serv => serv.id == item.serviceId);
        if(!service) return null;

        const subtotal = item.qty * service.value;
        total += subtotal;

        return {
            desc: service.desc,
            unit: service.unit,
            qty: item.qty,
            value: service.value,
            subtotal
        };
    }).filter(Boolean);

    return { items, total };
};

const buildBudgetMessage = ({ hidePrices = false } = {}) => {
    const client = document.getElementById('client-name').value || 'Cliente';
    const project = document.getElementById('client-project').value || 'Obra';
    const intro = document.getElementById('msg-intro').value;
    const footer = document.getElementById('msg-footer').value;
    const date = new Date().toLocaleDateString('pt-BR');
    const { items, total } = getCurrentBudgetDetails();

    let msg = hidePrices ? `*🏗 QUANTITATIVO DE OBRA 🏗*\n\n` : `*🏗 ORÇAMENTO DE OBRA 🏗*\n\n`;
    if(intro) msg += `${intro}\n\n`;

    msg += `👤 Cliente: ${client}\n`;
    msg += `🏠 Obra: ${project}\n`;
    msg += `📅 Data: ${date}\n\n`;
    msg += `📋 DETALHAMENTO DOS SERVIÇOS:\n\n`;

    items.forEach((item) => {
        msg += `🔸 ${item.desc}\n`;
        if(hidePrices) {
            msg += `   Quantidade: ${item.qty} ${item.unit}\n\n`;
        } else {
            msg += `   ${item.qty} ${item.unit} x ${formatMoney(item.value)}\n`;
            msg += `   Subtotal: ${formatMoney(item.subtotal)}\n\n`;
        }
    });

    if(!hidePrices) {
        msg += `─────────────────────\n`;
        msg += `💰 *VALOR TOTAL: ${formatMoney(total)}*\n`;
        msg += `─────────────────────\n\n`;
    }

    if(footer) msg += `${footer}`;

    return msg;
};

const generateBudgetImage = async ({ hidePrices = false } = {}) => {
    const client = document.getElementById('client-name').value || 'Cliente';
    const project = document.getElementById('client-project').value || 'Obra';
    const footer = document.getElementById('msg-footer').value;
    const date = new Date().toLocaleDateString('pt-BR');
    const { items, total } = getCurrentBudgetDetails();
    const canvas = document.createElement('canvas');
    const width = 1080;
    let logo = null;
    let headerHeight = 300;

    if(state.companyLogo) {
        try {
            logo = await loadImageFromDataURL(state.companyLogo);
            headerHeight = Math.round(width * (logo.height / logo.width));
        } catch {
            logo = null;
        }
    }

    const titleTop = headerHeight;
    const titleHeight = 170;
    const clientTop = titleTop + titleHeight + 50;
    const servicesTop = clientTop + 250;
    const rowHeight = hidePrices ? 112 : 170;
    canvas.width = width;
    const measureCtx = canvas.getContext('2d');
    measureCtx.font = '500 26px Inter, Arial';

    const footerLineCount = footer ? countWrappedCanvasLines(measureCtx, footer, width - 180) : 0;
    const footerBlockHeight = footer ? 60 + (footerLineCount * 38) : 0;
    const itemsBlockHeight = 34 + (items.length * (rowHeight + 26));
    const totalBlockHeight = hidePrices ? 42 : 172;
    const height = Math.max(1920, servicesTop + itemsBlockHeight + totalBlockHeight + footerBlockHeight + 90);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    if(logo) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, headerHeight);
        ctx.drawImage(logo, 0, 0, width, headerHeight);
    } else {
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(0, 0, width, headerHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 92px Inter, Arial';
        ctx.fillText('MO', 470, 184);
    }

    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, titleTop, width, titleHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 50px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(hidePrices ? 'QUANTITATIVO DE OBRA' : 'ORÇAMENTO DE OBRA', width / 2, titleTop + 72);
    ctx.font = '500 28px Inter, Arial';
    ctx.fillText(`Emitido em ${date}`, width / 2, titleTop + 122);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(56, clientTop, width - 112, 178);
    ctx.fillStyle = '#111827';
    ctx.font = '700 38px Inter, Arial';
    ctx.fillText(fitCanvasText(ctx, client, width - 172), 86, clientTop + 72);
    ctx.fillStyle = '#4b5563';
    ctx.font = '500 30px Inter, Arial';
    ctx.fillText(fitCanvasText(ctx, project, width - 172), 86, clientTop + 124);

    let y = servicesTop;
    ctx.fillStyle = '#111827';
    ctx.font = '700 34px Inter, Arial';
    ctx.fillText('Serviços', 56, y);
    y += 34;

    items.forEach((item, index) => {
        y += 26;
        ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f1f5f9';
        ctx.fillRect(56, y - 28, width - 112, rowHeight);

        ctx.fillStyle = '#111827';
        ctx.font = '700 31px Inter, Arial';
        ctx.fillText(fitCanvasText(ctx, item.desc, 900), 86, y + 24);

        ctx.fillStyle = '#4b5563';
        ctx.font = '500 27px Inter, Arial';
        if(hidePrices) {
            ctx.fillText(`Quantidade: ${item.qty} ${item.unit}`, 86, y + 76);
        } else {
            ctx.fillText(`${item.qty} ${item.unit} x ${formatMoney(item.value)}`, 86, y + 70);
            ctx.fillStyle = '#047857';
            ctx.font = '700 30px Inter, Arial';
            ctx.fillText(formatMoney(item.subtotal), 760, y + 122);
        }

        y += rowHeight;
    });

    if(!hidePrices) {
        y += 34;
        ctx.fillStyle = '#dcfce7';
        ctx.fillRect(56, y, width - 112, 96);
        ctx.fillStyle = '#166534';
        ctx.font = '700 34px Inter, Arial';
        ctx.fillText('Valor total', 86, y + 60);
        ctx.font = '700 42px Inter, Arial';
        ctx.fillText(formatMoney(total), 710, y + 60);
        y += 138;
    } else {
        y += 42;
    }

    if(footer) {
        y += 16;
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(110, y, width - 220, 2);
        y += 42;
        ctx.fillStyle = '#374151';
        ctx.font = '500 26px Inter, Arial';
        wrapCanvasText(ctx, footer, 90, y, width - 180, 38);
    }

    return canvasToFile(canvas, hidePrices ? 'quantitativo-de-obra.png' : 'orcamento-de-obra.png');
};

const shareBudgetImage = async (imageFile) => {
    const shareData = {
        title: 'Orçamento de Obra',
        files: [imageFile]
    };

    if(navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
    }

    return false;
};

const shareBudgetTextWithLogo = async (msg) => {
    if(!navigator.share) return false;

    if(state.companyLogo && navigator.canShare) {
        const logoFile = dataURLToFile(state.companyLogo, 'logo-da-empresa.png');
        const shareData = {
            title: 'Orçamento de Obra',
            text: msg,
            files: [logoFile]
        };

        if(navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return true;
        }
    }

    await navigator.share({ title: 'Orçamento de Obra', text: msg });
    return true;
};

const persistCurrentBudgetDraft = () => {
    const client = document.getElementById('client-name')?.value || '';
    const project = document.getElementById('client-project')?.value || '';
    localStorage.setItem(STORAGE_KEYS.currentDraft, JSON.stringify({ client, project, items: currentBudgetItems }));
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
    persistCurrentBudgetDraft();
};

document.getElementById('btn-reset-app').addEventListener('click', () => {
    if(confirm('Limpar todos os dados do app?')) { 
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        location.reload(); 
    }
});

document.getElementById('form-add-service').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('service-desc').value.trim();
    const unit = document.getElementById('service-unit').value.trim();
    const value = parseFloat(document.getElementById('service-value').value);

    if(!desc || !unit || !Number.isFinite(value) || value <= 0) {
        return alert('Preencha descrição, unidade e um valor válido maior que zero.');
    }
    
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
    const serviceExists = state.services.some((serv) => String(serv.id) === String(serviceId));
    
    if(!serviceId || !serviceExists || !Number.isFinite(qty) || qty <= 0) {
        return alert('Selecione um serviço e informe uma quantidade válida maior que zero.');
    }

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

document.getElementById('company-logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    if(!file.type.startsWith('image/')) {
        e.target.value = '';
        return alert('Selecione uma imagem válida para a logo.');
    }

    try {
        state.companyLogo = await resizeImageFile(file);
        saveData();
        renderCompanyLogo();
    } catch {
        alert('Não foi possível carregar a logo. Tente outra imagem.');
    } finally {
        e.target.value = '';
    }
});

document.getElementById('btn-remove-logo').addEventListener('click', () => {
    state.companyLogo = '';
    saveData();
    renderCompanyLogo();
});

document.getElementById('msg-intro').addEventListener('input', persistMessageSettings);
document.getElementById('msg-footer').addEventListener('input', persistMessageSettings);
document.getElementById('hide-budget-prices').addEventListener('change', persistMessageSettings);
document.getElementById('budget-send-mode').addEventListener('change', persistMessageSettings);

document.getElementById('btn-whatsapp').addEventListener('click', async () => {
    if(currentBudgetItems.length === 0) return alert('Adicione itens ao orçamento!');

    const hidePrices = document.getElementById('hide-budget-prices').checked;
    const sendMode = document.getElementById('budget-send-mode').value;
    const msg = buildBudgetMessage({ hidePrices });

    if(sendMode === 'image') {
        try {
            const imageFile = await generateBudgetImage({ hidePrices });
            const shared = await shareBudgetImage(imageFile);
            if(shared) return;

            downloadFile(imageFile);
            alert('Este navegador não permite anexar a foto automaticamente. Baixei a foto do orçamento para você anexar manualmente no WhatsApp.');
            return;
        } catch {
            alert('Não foi possível gerar a foto do orçamento.');
            return;
        }
    }

    try {
        const shared = await shareBudgetTextWithLogo(msg);
        if(shared) return;
    } catch {
        return;
    }

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
    const desc = document.getElementById('fin-desc').value.trim();
    const val = parseFloat(document.getElementById('fin-val').value);

    if(!desc || (type !== 'in' && type !== 'out') || !Number.isFinite(val) || val <= 0) {
        return alert('Informe tipo, descrição e valor válido maior que zero.');
    }
    
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
    const name = document.getElementById('worker-name').value.trim();
    const rate = parseFloat(document.getElementById('worker-rate').value);

    if(!name || !Number.isFinite(rate) || rate <= 0) {
        return alert('Informe um nome e valor de diária válido maior que zero.');
    }

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
renderCompanyLogo();
renderMessageSettings();

document.getElementById('client-name').value = budgetDraft.client || '';
document.getElementById('client-project').value = budgetDraft.project || '';
document.getElementById('client-name').addEventListener('input', persistCurrentBudgetDraft);
document.getElementById('client-project').addEventListener('input', persistCurrentBudgetDraft);

renderCurrentBudget();
