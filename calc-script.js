/**
 * КАЛЬКУЛЯТОР 1С-ОТЧЕТНОСТЬ
 * Изолированная версия с глобальным объектом CalcApp
 */

(function() {
'use strict';

/**
 * 1. КОНФИГУРАЦИЯ
 */
const CONFIG = {
    columns: {
        ul_base: 'ЮЛ',
        ip_base: 'ИП',
        ul_2year: 'Column4',
        ip_2year: 'Column13',
        multi_small: 'Многопользовательский режим',
        multi_large: 'Column29',
        lk_base: 'Column31',
        lk_prof: 'Column33',
        mchd_1: 'Старт работы с МЧД в 1С-Отчетность',
        mchd_2: 'Column37',
        mchd_3: 'Column38',
        setup_1: 'Удалённая настройка рабочего места для работы с электронной подписью',
        setup_2: 'Column40',
        setup_3: 'Column41',
        setup_4: 'Column42'
    },
    globalAddons: [
        {
            id: 'mchd',
            title: 'Старт работы с МЧД в 1С-Отчетность',
            items: [
                { id: 'v1', label: 'Старт работы с МЧД в 1С-Отчетность (1 МЧД)', col: 'mchd_1' },
                { id: 'v2', label: 'Старт работы с МЧД в 1С-Отчетность (2 МЧД)', col: 'mchd_2' },
                { id: 'v3', label: 'Старт работы с МЧД в 1С-Отчетность (3 МЧД)', col: 'mchd_3' }
            ]
        },
        {
            id: 'setup',
            title: 'Удалённая настройка рабочего места',
            items: [
                { id: 's1', label: 'Удалённая настройка рабочего места для OC Windows (nalog.ru или ЕСИА)', col: 'setup_1' },
                { id: 's2', label: 'Удалённая настройка рабочего места для OC Windows (nalog.ru и ЕСИА)', col: 'setup_2' },
                { id: 's3', label: 'Удалённая настройка рабочего места для OC MacOS (nalog.ru или ЕСИА)', col: 'setup_3' },
                { id: 's4', label: 'Удалённая настройка рабочего места для OC MacOS (nalog.ru и ЕСИА)', col: 'setup_4' }
            ]
        }
    ],
    extraServices: [
        { key: 'lk', val: 'base', col: 'lk_base', label: 'ЛК Базовый' },
        { key: 'lk', val: 'prof', col: 'lk_prof', label: 'ЛК Проф' },
        { key: 'multiUser', val: 'small', col: 'multi_small', label: 'Многопользовательский режим (2-9)' },
        { key: 'multiUser', val: 'large', col: 'multi_large', label: 'Многопользовательский режим (10+)' }
    ],
    // Пути к изображениям - берем из data-атрибутов
    getAssetPath(type) {
        const assets = document.getElementById('calc-assets');
        if (!assets) return '';
        return assets.dataset[type + 'Img'] || '';
    }
};

/**
 * 2. СОСТОЯНИЕ (STATE)
 */
const STATE = {
    tariffs: [],
    tariffMap: {},
    isGroup: false,
    mode: 'fast',
    existingCount: 0,
    solo: { region: '', ownership: 'ul', duration: '1', employees: 1 },
    fastRows: [{ id: Date.now(), region: '', ulCount: 1, ipCount: 0 }],
    detailedCompanies: [{ id: Date.now(), name: '', inn: '', region: '', ownership: 'ul', lk: 'none', multiUser: 'none' }],
    manualDiscount: { type: 'percent', value: 0 },
    addons: {},
    customPrices: {}
};

CONFIG.globalAddons.forEach(g => {
    STATE.addons[g.id] = { enabled: false, values: {} };
    g.items.forEach(i => STATE.addons[g.id].values[i.id] = 0);
});

/**
 * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
const formatPrice = (v) => Math.round(v).toLocaleString('ru-RU') + ' ₽';

const getPrice = (tariff, configKey) => {
    const columnName = CONFIG.columns[configKey];
    return parseInt(tariff[columnName]) || 0;
};

const getRegionOptions = (selected) => {
    let options = `<option value="" ${!selected ? 'selected' : ''} disabled>Выберите регион</option>`;
    options += STATE.tariffs.map(t => `<option value="${t.Код}" ${selected == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('');
    return options;
};

/**
 * 4. ИНИЦИАЛИЗАЦИЯ
 */
function init() {
    // Восстановление данных
    const fields = ['partner-phone', 'partner-email', 'partner-name'];
    fields.forEach(id => {
        const saved = localStorage.getItem(`p-${id}`);
        const el = document.getElementById(`calc-${id}`);
        if (saved && el) el.value = saved;
        if (el) el.oninput = (e) => localStorage.setItem(`p-${id}`, e.target.value);
    });

    const savedPrices = localStorage.getItem('my_custom_prices');
    if (savedPrices) {
        try {
            STATE.customPrices = JSON.parse(savedPrices);
        } catch (e) {
            console.error("Ошибка загрузки цен:", e);
            STATE.customPrices = {};
        }
    }

    // Настройка ручной скидки
    const discType = document.getElementById('calc-manual-disc-type');
    const discVal = document.getElementById('calc-manual-disc-val');
    
    if (discType) {
        discType.onchange = (e) => {
            STATE.manualDiscount.type = e.target.value;
            validateManualDiscount(discVal);
            calculate();
        };
    }

    if (discVal) {
        discVal.oninput = (e) => {
            validateManualDiscount(e.target);
            STATE.manualDiscount.value = parseFloat(e.target.value) || 0;
            calculate();
        };
    }

    setupEventListeners();
    
    // Загрузка данных
    loadData();
}

function validateManualDiscount(input) {
    if (!input) return;
    if (STATE.manualDiscount.type === 'percent') {
        let val = parseFloat(input.value);
        if (val < 0) input.value = 0;
        if (val > 100) input.value = 100;
    }
}

async function loadData() {
    try {
        const res = await fetch('Цены для Калькулятора 1СО.json');
        const data = await res.json();
        STATE.tariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
        STATE.tariffMap = Object.fromEntries(STATE.tariffs.map(t => [t.Код, t]));
        render();
    } catch (e) {
        console.error("Ошибка загрузки данных:", e);
    }
}

function setupEventListeners() {
    // Переключение Группа/Одиночная
    const groupBtns = document.querySelectorAll('#calc-group-main-toggle .calc-toggle-btn');
    groupBtns.forEach(btn => {
        btn.onclick = (e) => {
            groupBtns.forEach(b => b.classList.remove('calc-selected'));
            e.target.classList.add('calc-selected');
            STATE.isGroup = e.target.dataset.value === 'yes';
            const container = document.getElementById('calc-mode-selection-container');
            if (container) container.style.display = STATE.isGroup ? 'block' : 'none';
            render();
        };
    });

    // Переключение табов
    const tabBtns = document.querySelectorAll('.calc-tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = (e) => {
            tabBtns.forEach(b => b.classList.remove('calc-selected'));
            e.target.classList.add('calc-selected');
            STATE.mode = e.target.dataset.mode;
            render();
        };
    });
}

/**
 * 5. РЕНДЕРИНГ
 */
function render() {
    const container = document.getElementById('calc-dynamic-fields');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!STATE.isGroup) {
        renderSoloMode(container);
    } else {
        if (STATE.mode === 'addon') renderDetailedMode(container, true);
        else if (STATE.mode === 'detailed') renderDetailedMode(container, false);
        else renderFastGroupMode(container);
    }
    renderGlobalAddons();
    calculate();
}

function renderSoloMode(container) {
    const tpl = document.getElementById('calc-tpl-solo-mode');
    if (!tpl) return;
    const content = tpl.content.cloneNode(true);
    
    const regSelect = content.getElementById('calc-s-reg');
    if (regSelect) {
        regSelect.innerHTML = getRegionOptions(STATE.solo.region);
        regSelect.onchange = (e) => CalcApp.updateSolo('region', e.target.value);
    }

    content.querySelectorAll('#calc-solo-ownership .calc-toggle-btn').forEach(b => {
        if (b.dataset.val === STATE.solo.ownership) b.classList.add('calc-selected');
        b.onclick = () => CalcApp.updateSolo('ownership', b.dataset.val);
    });

    content.querySelectorAll('#calc-solo-duration .calc-toggle-btn').forEach(b => {
        if (b.dataset.val === STATE.solo.duration) b.classList.add('calc-selected');
        b.onclick = () => CalcApp.updateSolo('duration', b.dataset.val);
    });

    const empInput = content.getElementById('calc-solo-employees');
    if (empInput) {
        empInput.value = STATE.solo.employees;
        empInput.oninput = (e) => CalcApp.updateSolo('employees', e.target.value);
    }

    container.appendChild(content);
}

function renderFastGroupMode(container) {
    const tpl = document.getElementById('calc-tpl-fast-mode');
    if (!tpl) return;
    const content = tpl.content.cloneNode(true);
    const rowsCont = content.getElementById('calc-f-rows');

    STATE.fastRows.forEach(row => {
        const div = document.createElement('div');
        div.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";
        div.innerHTML = `
            <select onchange="CalcApp.updateFast(${row.id},'region',this.value)">${getRegionOptions(row.region)}</select>
            <input type="number" value="${row.ulCount}" oninput="CalcApp.updateFast(${row.id},'ulCount',this.value)" style="text-align: center;">
            <input type="number" value="${row.ipCount}" oninput="CalcApp.updateFast(${row.id},'ipCount',this.value)" style="text-align: center;">
            <button onclick="CalcApp.removeFast(${row.id})" style="color:#ccc; background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>`;
        rowsCont.appendChild(div);
    });
    container.appendChild(content);
}

function renderDetailedMode(container, showExisting) {
    const mainTpl = document.getElementById('calc-tpl-detailed-mode');
    if (!mainTpl) return;
    const content = mainTpl.content.cloneNode(true);
    
    if (showExisting) {
        const row = content.getElementById('calc-existing-count-row');
        if (row) row.style.display = 'flex';
        const inp = content.getElementById('calc-existing-input');
        if (inp) {
            inp.value = STATE.existingCount;
            inp.oninput = (e) => { STATE.existingCount = parseInt(e.target.value) || 0; calculate(); };
        }
    }

    const cardsContainer = content.getElementById('calc-det-cards');

    STATE.detailedCompanies.forEach((comp, idx) => {
        const cardTpl = document.getElementById('calc-tpl-company-card');
        if (!cardTpl) return;
        const cardContent = cardTpl.content.cloneNode(true);
        
        const nameInp = cardContent.querySelector('.calc-comp-name-input');
        nameInp.value = comp.name;
        nameInp.oninput = (e) => CalcApp.updateDet(comp.id, 'name', e.target.value, false);

        const innInp = cardContent.querySelector('.calc-comp-inn-input');
        innInp.value = comp.inn;
        innInp.style.borderColor = (comp.inn.length === 0 || [10, 12].includes(comp.inn.length)) ? '' : 'red';
        innInp.oninput = (e) => CalcApp.updateDet(comp.id, 'inn', e.target.value, false);

        const regSel = cardContent.querySelector('.calc-comp-region-select');
        regSel.innerHTML = getRegionOptions(comp.region);
        regSel.onchange = (e) => CalcApp.updateDet(comp.id, 'region', e.target.value);

        cardContent.querySelectorAll('.calc-ownership-group .calc-toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.ownership) btn.classList.add('calc-selected');
            btn.onclick = () => CalcApp.updateDet(comp.id, 'ownership', btn.dataset.val);
        });

        cardContent.querySelectorAll('.calc-lk-group .calc-toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.lk) btn.classList.add('calc-selected');
            btn.onclick = () => CalcApp.toggleOption(comp.id, 'lk', btn.dataset.val);
        });

        cardContent.querySelectorAll('.calc-multi-group .calc-toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.multiUser) btn.classList.add('calc-selected');
            btn.onclick = () => CalcApp.toggleOption(comp.id, 'multiUser', btn.dataset.val);
        });

        if (idx > 0) {
            const delBtn = cardContent.querySelector('.calc-remove-card-btn');
            if (delBtn) {
                delBtn.style.display = 'block';
                delBtn.onclick = () => CalcApp.removeDet(comp.id);
            }
        }

        cardsContainer.appendChild(cardContent);
    });

    container.innerHTML = '';
    container.appendChild(content);
}

function renderGlobalAddons() {
    const container = document.getElementById('calc-global-addons-container');
    if (!container) return;
    container.innerHTML = '';

    const refTariff = STATE.tariffs[0] || {};

    CONFIG.globalAddons.forEach(addon => {
        const state = STATE.addons[addon.id];
        const card = document.createElement('div');
        card.setAttribute('data-addon-id', addon.id);
        card.className = `calc-addon-card ${state.enabled ? 'calc-active' : ''}`;
        
        let variantsHtml = '';
        let priceSettingsHtml = '';

        addon.items.forEach(item => {
            const defaultPrice = parseInt(refTariff[CONFIG.columns[item.col]]) || 0;
            const customPrice = STATE.customPrices[item.col];

            variantsHtml += `
                <div class="calc-variant-row">
                    <span style="flex: 1; padding-right: 10px;">${item.label}</span>
                    <input type="number" min="0" placeholder="0" 
                        value="${state.values[item.id] || ''}" 
                        oninput="CalcApp.updateAddonValue('${addon.id}', '${item.id}', this.value)">
                </div>`;

            priceSettingsHtml += `
                <div class="calc-variant-row" style="border-bottom: 1px dashed #eee; padding: 5px 0;">
                    <span>${item.label}</span>
                    <input type="number" 
                        min="0" 
                        placeholder="${defaultPrice}" 
                        value="${customPrice !== undefined ? customPrice : ''}" 
                        style="width: 70px; background: #fffcf0; border-color: #ffd1a4;"
                        onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                        oninput="CalcApp.updateCustomPrice('${item.col}', this.value)">
                </div>`;
        });

        card.innerHTML = `
            <div class="calc-addon-header">
                <span class="calc-addon-title">${addon.title}</span>
                <label class="calc-custom-switch">
                    <input type="checkbox" ${state.enabled ? 'checked' : ''} onchange="CalcApp.toggleAddon('${addon.id}')">
                    <span class="calc-slider"></span>
                </label>
            </div>
            <div class="calc-addon-variants">
                ${variantsHtml}
                <details style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    <summary style="font-size: 11px; color: #FF5D5B; cursor: pointer; font-weight: 600;">Изменить стоимость</summary>
                    <div style="margin-top: 10px; background: #fafafa; padding: 10px; border-radius: 8px;">
                        ${priceSettingsHtml}
                    </div>
                </details>
            </div>`;
        container.appendChild(card);
    });
}

/**
 * 6. ЛОГИКА РАСЧЕТОВ
 */
function calculate() {
    let total = 0;
    let discBaseTotal = 0;
    let discCurrentTotal = 0;
    let logs = [];

    const ui = {
        price: document.getElementById('calc-total-price'),
        details: document.getElementById('calc-details-content'),
        discount: document.getElementById('calc-discount-info')
    };

    if (!ui.price || !ui.details || !ui.discount) return;

    if (!STATE.isGroup) {
        ui.discount.style.display = 'none';
        const t = STATE.tariffMap[STATE.solo.region];
        
        if (t) {
            const isTwo = STATE.solo.duration === '2';
            const isUL = STATE.solo.ownership === 'ul';
            
            const mainPriceKey = isUL ? (isTwo ? 'ul_2year' : 'ul_base') : (isTwo ? 'ip_2year' : 'ip_base');
            const price = getPrice(t, mainPriceKey);
            
            total += price;
            logs.push(`Лицензия ${isUL ? 'ЮЛ' : 'ИП'}, ${t.Регион}, ${isTwo ? '2 года' : '1 год'} | ${formatPrice(price)}`);

            const empCount = (STATE.solo.employees === "" || STATE.solo.employees === 0) ? 1 : STATE.solo.employees;

            let multiKey = null;
            if (empCount >= 2 && empCount <= 9) multiKey = 'multi_small';
            else if (empCount >= 10) multiKey = 'multi_large';

            if (multiKey) {
                const pMulti = getPrice(t, multiKey);
                total += pMulti;
                logs.push(`${CONFIG.extraServices.find(s => s.col === multiKey).label} | ${formatPrice(pMulti)}`);
            }
        }
    } else {
        const count = (STATE.mode === 'addon' ? STATE.existingCount : 0) + 
                      (STATE.mode === 'fast' ? STATE.fastRows.reduce((a, b) => a + (parseInt(b.ulCount)||0) + (parseInt(b.ipCount)||0), 0) : STATE.detailedCompanies.length);
        
        if (count < 3) {
            ui.price.textContent = "Мин. 3 орг.";
            ui.details.innerText = "Нужно минимум 3 организации.";
            return;
        }

        ui.discount.style.display = 'block';
        const col = getGroupColumnKey(count);

        if (STATE.mode === 'fast') {
            STATE.fastRows.forEach(r => {
                const t = STATE.tariffMap[r.region];
                if (!t) return;
                if (r.ulCount > 0) {
                    const pGK = parseInt(t[col.ul]) || 0;
                    const pBase = getPrice(t, 'ul_base');
                    total += pGK * r.ulCount;
                    discCurrentTotal += pGK * r.ulCount;
                    discBaseTotal += pBase * r.ulCount;
                    logs.push(`ЮЛ (${t.Регион}) | ${formatPrice(pGK)} x ${r.ulCount} | ${formatPrice(pGK * r.ulCount)}`);
                }
                if (r.ipCount > 0) {
                    const pGK = parseInt(t[col.ip]) || 0;
                    const pBase = getPrice(t, 'ip_base');
                    total += pGK * r.ipCount;
                    discCurrentTotal += pGK * r.ipCount;
                    discBaseTotal += pBase * r.ipCount;
                    logs.push(`ИП (${t.Регион}) | ${formatPrice(pGK)} x ${r.ipCount} | ${formatPrice(pGK * r.ipCount)}`);
                }
            });
        } else {
            STATE.detailedCompanies.forEach(c => {
                const t = STATE.tariffMap[c.region];
                if (!t) return;
                const isUL = c.ownership === 'ul';
                const pGK = parseInt(t[isUL ? col.ul : col.ip]) || 0;
                const pBase = getPrice(t, isUL ? 'ul_base' : 'ip_base');
                const compName = c.name || 'Организация';

                logs.push(`${compName} (${isUL ? 'ЮЛ' : 'ИП'}, ${t.Регион}) | ${formatPrice(pGK)}`);
                total += pGK;
                discCurrentTotal += pGK;
                discBaseTotal += pBase;

                CONFIG.extraServices.forEach(srv => {
                    if (c[srv.key] === srv.val) {
                        const srvPrice = getPrice(t, srv.col);
                        total += srvPrice;
                        logs.push(`      ${compName} - ${srv.label} | ${formatPrice(srvPrice)}`);
                    }
                });
            });
        }
        const pct = discBaseTotal > 0 ? Math.round(((discBaseTotal - discCurrentTotal) / discBaseTotal) * 100) : 0;
        ui.discount.innerHTML = `Скидка ГК: ${pct}% ⓘ`;
    }

    let refTariff = !STATE.isGroup ? STATE.tariffMap[STATE.solo.region] : STATE.tariffs[0];
    
    if (refTariff) {
        CONFIG.globalAddons.forEach(addon => {
            const state = STATE.addons[addon.id];
            if (state && state.enabled) {
                addon.items.forEach(item => {
                    const qty = parseInt(state.values[item.id]) || 0;
                    if (qty > 0) {
                        const defaultPrice = getPrice(refTariff, item.col);
                        const price = STATE.customPrices[item.col] !== undefined 
                                    ? STATE.customPrices[item.col] 
                                    : defaultPrice;

                        total += price * qty;
                        logs.push(`${item.label} | ${formatPrice(price)} x ${qty} | ${formatPrice(price * qty)}`);
                    }
                });
            }
        });
    }

    let finalTotal = total;
    if (STATE.manualDiscount.value > 0) {
        let discAmount = STATE.manualDiscount.type === 'percent' 
            ? total * (STATE.manualDiscount.value / 100) 
            : STATE.manualDiscount.value;
            
        logs.push(`\nДоп. скидка ${STATE.manualDiscount.type === 'percent' ? STATE.manualDiscount.value + '%' : '(руб)'} | -${formatPrice(discAmount)}`);
        finalTotal = Math.max(0, total - discAmount);
    }

    ui.price.textContent = formatPrice(finalTotal);
    ui.details.innerText = logs.join('\n');
}

function getGroupColumnKey(n) {
    if (n <= 5) return { ul: 'Column5', ip: 'Column14' };
    if (n <= 10) return { ul: 'Column6', ip: 'Column15' };
    if (n <= 15) return { ul: 'Column7', ip: 'Column16' };
    if (n <= 25) return { ul: 'Column8', ip: 'Column17' };
    if (n <= 50) return { ul: 'Column9', ip: 'Column18' };
    if (n <= 100) return { ul: 'Column10', ip: 'Column19' };
    return { ul: 'Column11', ip: 'Column20' };
}

/**
 * 7. PDF ГЕНЕРАЦИЯ
 */
function initPDF() {
    const pdfBtn = document.getElementById('calc-generate-pdf');
    if (!pdfBtn) return;
    
    pdfBtn.onclick = function() {
        const headerImg = CONFIG.getAssetPath('header');
        const footerImg = CONFIG.getAssetPath('footer');
        
        document.getElementById('calc-pdf-header-img').src = headerImg;
        document.getElementById('calc-pdf-footer-img').src = footerImg;
        
        const createPdfBlock = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const clone = el.cloneNode(true);
            clone.classList.add('calc-pdf-dynamic-el');
            clone.style.pageBreakInside = 'avoid';
            clone.style.display = 'block';
            return clone;
        };

        try {
            window.scrollTo(0, 0);
            const wrapper = document.getElementById('calc-pdf-container-wrapper');
            const template = document.getElementById('calc-pdf-template');
            const page1 = document.getElementById('calc-page-1');
            const page2 = document.getElementById('calc-page-2');
            const pageLast = document.getElementById('calc-page-last');

            const page2Copy = page2.cloneNode(true);
            const pageLastCopy = pageLast.cloneNode(true);

            document.querySelectorAll('.calc-pdf-dynamic-el').forEach(el => el.remove());
            
            const summary = createPdfBlock('calc-summary-block');
            summary.querySelector('.calc-pdf-total-val').innerText = document.getElementById('calc-total-price').innerText;
            
            const clientInput = document.getElementById('calc-client-name')?.value.trim();
            const clientTitleEl = summary.querySelector('#calc-pdf-client-title');
            if (clientTitleEl) {
                clientTitleEl.innerText = clientInput ? `Стоимость для ${clientInput}:` : "Стоимость для вас:";
            }

            const disc = document.getElementById('calc-discount-info');
            if (disc?.offsetParent) {
                summary.querySelector('.calc-pdf-discount-val').innerText = disc.innerText.replace('ⓘ', '');
            }

            const contactSource = document.getElementById('calc-contact-box-template');
            const contact1 = contactSource.cloneNode(true);
            contact1.classList.add('calc-pdf-dynamic-el');
            contact1.style.display = 'flex';
            contact1.style.pageBreakInside = 'avoid';

            const employeeInput = document.getElementById('calc-partner-name')?.value.trim();
            const empNameEl = contact1.querySelector('#calc-pdf-employee-name');
            if (empNameEl) {
                if (employeeInput) {
                    empNameEl.innerText = employeeInput;
                } else {
                    empNameEl.remove();
                }
            }

            contact1.querySelector('.calc-c-phone').innerText = document.getElementById('calc-partner-phone').value;
            contact1.querySelector('.calc-c-email').innerText = document.getElementById('calc-partner-email').value;
            
            const contact2 = contact1.cloneNode(true);

            const finalImg = document.createElement('img');
            finalImg.src = footerImg;
            finalImg.style = "width:100%; display:block; margin-top: 5px; page-break-inside: avoid;";
            finalImg.classList.add('calc-pdf-dynamic-el');

            const lines = document.getElementById('calc-details-content').innerText.split('\n').filter(l => l.trim());
            const rows1 = document.getElementById('calc-pdf-rows');
            const rows2 = page2.querySelector('#calc-pdf-rows-p2');
            
            rows1.innerHTML = '';
            if (rows2) rows2.innerHTML = '';

            lines.forEach((line, idx) => {
                const cleanLine = line.trim();
                const tr = document.createElement('tr');
                if (cleanLine.includes('|')) {
                    const parts = cleanLine.split('|');
                    const t = parts.length > 2 ? parts[0] + ' | ' + parts[1] : parts[0];
                    const p = parts[parts.length - 1];
                    tr.innerHTML = `<td style="padding:3px 0; border-bottom:1px solid #eee; font-size:10pt;">${t.trim()}</td>
                                    <td style="padding:3px 0; border-bottom:1px solid #eee; text-align:right; font-weight:700; color:#FF5D5B; font-size:10pt;">${p.trim()}</td>`;
                } else {
                    tr.innerHTML = `<td colspan="2" style="padding:3px 0; font-size:9pt; color:#666;">${cleanLine}</td>`;
                }
                if (idx < 16) rows1.appendChild(tr);
                else if (rows2) rows2.appendChild(tr);
            });

            const placeP1 = document.getElementById('calc-res-place-p1');
            const placeP2 = page2.querySelector('#calc-res-place-p2');
            placeP1.innerHTML = '';
            if (placeP2) placeP2.innerHTML = '';
            pageLast.innerHTML = '';

            if (lines.length > 7) {
                pageLast.remove();
                page2.style.display = 'block';
                if (lines.length >= 14 && placeP2) placeP2.appendChild(summary);
                else placeP1.appendChild(summary);
                
                if (placeP2) {
                    placeP2.appendChild(contact1);
                    placeP2.appendChild(finalImg);
                    placeP2.appendChild(contact2);
                }
            } else {
                page2.remove();
                pageLast.remove();
                placeP1.appendChild(summary);
                placeP1.appendChild(contact1);
                placeP1.appendChild(finalImg);
                placeP1.appendChild(contact2);
            }

            wrapper.style.display = 'block';

            html2pdf().set({
                margin: 0,
                filename: 'КП_1С_Отчетность.pdf',
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 3, useCORS: true },
                jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
            }).from(template).save().then(() => {
                wrapper.style.display = 'none';
                template.innerHTML = '';
                template.appendChild(page1);
                template.appendChild(page2Copy);
                template.appendChild(pageLastCopy);
            });

        } catch (e) {
            console.error("Ошибка PDF:", e);
        }
    };
}

/**
 * 8. ПУБЛИЧНЫЙ API
 */
const CalcApp = {
    updateSolo: (f, v) => {
        if (f === 'employees') {
            STATE.solo.employees = v === "" ? "" : Math.max(0, parseInt(v) || 0);
            calculate();
        } else {
            STATE.solo[f] = v;
            render();
        }
    },

    addFastRow: () => {
        STATE.fastRows.push({ id: Date.now(), region: '', ulCount: 1, ipCount: 0 });
        render();
    },

    updateFast: (id, f, v) => {
        const r = STATE.fastRows.find(x => x.id == id);
        if (r) r[f] = f.includes('Count') ? (parseInt(v) || 0) : v;
        calculate();
    },

    removeFast: (id) => {
        if (STATE.fastRows.length > 1) {
            STATE.fastRows = STATE.fastRows.filter(x => x.id != id);
            render();
        }
    },

    addDetailedCompany: () => {
        STATE.detailedCompanies.push({ id: Date.now(), name: '', inn: '', region: '', ownership: 'ul', lk: 'none', multiUser: 'none' });
        render();
    },

    updateDet: (id, f, v, redraw = true) => {
        const c = STATE.detailedCompanies.find(x => x.id == id);
        if (c) {
            if (f === 'name') {
                v = v.replace(/"([^"]*)"/g, '«$1»').replace(/"/g, '»');
            }
            c[f] = v;
        }
        if (redraw) render();
        else calculate();
    },

    removeDet: (id) => {
        if (STATE.detailedCompanies.length > 1) {
            STATE.detailedCompanies = STATE.detailedCompanies.filter(x => x.id != id);
            render();
        }
    },

    toggleOption: (id, field, value) => {
        const c = STATE.detailedCompanies.find(x => x.id == id);
        if (!c) return;
        c[field] = c[field] === value ? 'none' : value;
        if (field === 'lk' && c[field] !== 'none') c.multiUser = 'none';
        if (field === 'multiUser' && c[field] !== 'none') c.lk = 'none';
        render();
    },

    toggleAddon: (id) => {
        STATE.addons[id].enabled = !STATE.addons[id].enabled;
        const card = document.querySelector(`[data-addon-id="${id}"]`);
        if (card) {
            card.classList.toggle('calc-active', STATE.addons[id].enabled);
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = STATE.addons[id].enabled;
        }
        calculate();
    },

    updateAddonValue: (aId, iId, val) => {
        STATE.addons[aId].values[iId] = parseInt(val) || 0;
        calculate();
    },

    updateCustomPrice: (col, val) => {
        if (val === "") {
            delete STATE.customPrices[col];
        } else {
            let cleanVal = val.toString().replace(/\D/g, '');
            let numericValue = parseInt(cleanVal) || 0;
            STATE.customPrices[col] = numericValue;
        }
        localStorage.setItem('my_custom_prices', JSON.stringify(STATE.customPrices));
        calculate();
    },

    updateSoloEmployees: (val) => {
        const cleanVal = val.toString().replace(/\D/g, '');
        STATE.solo.employees = cleanVal === "" ? "" : parseInt(cleanVal);
        calculate();
    }
};

// Экспорт в глобальную область
window.CalcApp = CalcApp;

// Автоинициализация после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initPDF();
    });
} else {
    init();
    initPDF();
}

})();
