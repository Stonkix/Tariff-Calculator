/**
 * КАЛЬКУЛЯТОР 1С-ОТЧЕТНОСТЬ
 * Изолированная версия с глобальным объектом CalcApp
 */

(function() {
'use strict';

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
    getAssetPath(type) {
        const assets = document.getElementById('calc-assets');
        if (!assets) return '';
        return assets.dataset[type + 'Img'] || '';
    }
};

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

function init() {
    const fields = ['partner-phone', 'partner-email', 'partner-name'];
    fields.forEach(id => {
        const saved = localStorage.getItem(`p-${id}`);
        const el = document.getElementById(`calc-${id}`);
        if (saved && el) el.value = saved;
        if (el) el.oninput = (e) => localStorage.setItem(`p-${id}`, e.target.value);
    });

    const savedPrices = localStorage.getItem('my_custom_prices');
    if (savedPrices) {
        try { STATE.customPrices = JSON.parse(savedPrices); }
        catch (e) { STATE.customPrices = {}; }
    }

    const discType = document.getElementById('calc-manual-disc-type');
    const discVal = document.getElementById('calc-manual-disc-val');
    if (discType) discType.onchange = (e) => { STATE.manualDiscount.type = e.target.value; validateManualDiscount(discVal); calculate(); };
    if (discVal) discVal.oninput = (e) => { validateManualDiscount(e.target); STATE.manualDiscount.value = parseFloat(e.target.value) || 0; calculate(); };

    setupEventListeners();
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
            if (delBtn) { delBtn.style.display = 'block'; delBtn.onclick = () => CalcApp.removeDet(comp.id); }
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
        let variantsHtml = '', priceSettingsHtml = '';
        addon.items.forEach(item => {
            const defaultPrice = parseInt(refTariff[CONFIG.columns[item.col]]) || 0;
            const customPrice = STATE.customPrices[item.col];
            variantsHtml += `
                <div class="calc-variant-row">
                    <span style="flex: 1; padding-right: 10px;">${item.label}</span>
                    <input type="number" min="0" placeholder="0" value="${state.values[item.id] || ''}"
                        oninput="CalcApp.updateAddonValue('${addon.id}', '${item.id}', this.value)">
                </div>`;
            priceSettingsHtml += `
                <div class="calc-variant-row" style="border-bottom: 1px dashed #eee; padding: 5px 0;">
                    <span>${item.label}</span>
                    <input type="number" min="0" placeholder="${defaultPrice}"
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
                    <div style="margin-top: 10px; background: #fafafa; padding: 10px; border-radius: 8px;">${priceSettingsHtml}</div>
                </details>
            </div>`;
        container.appendChild(card);
    });
}

function calculate() {
    let total = 0, discBaseTotal = 0, discCurrentTotal = 0;
    const logs = [];
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
                    const pGK = parseInt(t[col.ul]) || 0, pBase = getPrice(t, 'ul_base');
                    total += pGK * r.ulCount; discCurrentTotal += pGK * r.ulCount; discBaseTotal += pBase * r.ulCount;
                    logs.push(`ЮЛ (${t.Регион}) | ${formatPrice(pGK)} x ${r.ulCount} | ${formatPrice(pGK * r.ulCount)}`);
                }
                if (r.ipCount > 0) {
                    const pGK = parseInt(t[col.ip]) || 0, pBase = getPrice(t, 'ip_base');
                    total += pGK * r.ipCount; discCurrentTotal += pGK * r.ipCount; discBaseTotal += pBase * r.ipCount;
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
                total += pGK; discCurrentTotal += pGK; discBaseTotal += pBase;
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

    const refTariff = !STATE.isGroup ? STATE.tariffMap[STATE.solo.region] : STATE.tariffs[0];
    if (refTariff) {
        CONFIG.globalAddons.forEach(addon => {
            const state = STATE.addons[addon.id];
            if (state && state.enabled) {
                addon.items.forEach(item => {
                    const qty = parseInt(state.values[item.id]) || 0;
                    if (qty > 0) {
                        const defaultPrice = getPrice(refTariff, item.col);
                        const price = STATE.customPrices[item.col] !== undefined ? STATE.customPrices[item.col] : defaultPrice;
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
    if (n <= 5)   return { ul: 'Column5',  ip: 'Column14' };
    if (n <= 10)  return { ul: 'Column6',  ip: 'Column15' };
    if (n <= 15)  return { ul: 'Column7',  ip: 'Column16' };
    if (n <= 25)  return { ul: 'Column8',  ip: 'Column17' };
    if (n <= 50)  return { ul: 'Column9',  ip: 'Column18' };
    if (n <= 100) return { ul: 'Column10', ip: 'Column19' };
    return { ul: 'Column11', ip: 'Column20' };
}

// ─── PDF ──────────────────────────────────────────────────────────────────

function initPDF() {
    const pdfBtn = document.getElementById('calc-generate-pdf');
    if (!pdfBtn) return;
    pdfBtn.onclick = async function() {
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'Формируем PDF...';
        try { await buildPDF(); }
        catch(e) { console.error("Ошибка PDF:", e); alert("Ошибка PDF: " + e.message); }
        finally { pdfBtn.disabled = false; pdfBtn.textContent = 'Скачать коммерческое предложение'; }
    };
}

async function buildPDF() {
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass) throw new Error('jsPDF не найден. Проверьте подключение скрипта jspdf.umd.min.js');
    if (typeof html2canvas === 'undefined') throw new Error('html2canvas не найден');

    const PAGE_W  = 794;   // ширина страницы в px (DOM)
    const PAGE_H  = 1122;  // высота страницы A4 в px (DOM)
    const PAD     = 50;    // горизонтальный отступ контента
    const MF      = "font-family:'Montserrat',sans-serif;box-sizing:border-box;";

    // ─── Данные ──────────────────────────────────────────────────────────
    const totalText    = document.getElementById('calc-total-price')?.innerText || '';
    const discEl       = document.getElementById('calc-discount-info');
    const discText     = (discEl && discEl.offsetParent !== null) ? discEl.innerText.replace('ⓘ','').trim() : '';
    const clientName   = document.getElementById('calc-client-name')?.value.trim() || '';
    const partnerName  = document.getElementById('calc-partner-name')?.value.trim() || '';
    const partnerPhone = document.getElementById('calc-partner-phone')?.value.trim() || '';
    const partnerEmail = document.getElementById('calc-partner-email')?.value.trim() || '';
    const lines        = (document.getElementById('calc-details-content')?.innerText || '')
        .split('\n').map(s => s.trim()).filter(Boolean);

    // Пути к изображениям — footer нумерованные, рядом с html
    const headerSrc  = CONFIG.getAssetPath('header');
    const baseDir    = headerSrc ? headerSrc.replace(/[^/\\]*$/, '') : '';
    const FOOTER_N   = 6;
    const footerSrcs = Array.from({length: FOOTER_N}, (_, i) => `${baseDir}pdf-footer-${i+1}.jpg`);

    // ─── Helpers ─────────────────────────────────────────────────────────
    const waitImg = img => new Promise(res => {
        if (!img.src) { res(); return; }
        if (img.complete && img.naturalHeight > 0) { res(); return; }
        img.onload = img.onerror = res;
    });
    const mount = el => {
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '-9999px';
        el.style.zIndex = '-1';
        document.body.appendChild(el);
    };
    const unmount = el => { if (el && el.parentNode) el.parentNode.removeChild(el); };
    const toCanvas = el => html2canvas(el, {
        scale: 5, useCORS: true, allowTaint: true, logging: false,
        width: PAGE_W, windowWidth: PAGE_W
    });

    const rowHTML = line => {
        if (!line.includes('|'))
            return `<tr><td colspan="2" style="padding:3px 0;font-size:9pt;color:#999;${MF}">${line}</td></tr>`;
        const parts = line.split('|');
        const lbl   = parts.length > 2 ? parts[0].trim() + ' | ' + parts[1].trim() : parts[0].trim();
        const pr    = parts[parts.length-1].trim();
        return `<tr>
            <td style="padding:5px 0;border-bottom:1px solid #eee;font-size:9.5pt;${MF}">${lbl}</td>
            <td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#FF5D5B;font-size:9.5pt;white-space:nowrap;${MF}">${pr}</td>
        </tr>`;
    };

    const summaryHTML = () => {
        const lbl  = clientName ? `Стоимость для ${clientName}:` : 'Итоговая стоимость:';
        const disc = discText ? `<div style="color:#27ae60;font-weight:700;font-size:11px;margin-top:4px;">${discText}</div>` : '';
        return `<div style="background:#ffdbdb;padding:16px 20px;border-radius:12px;text-align:center;margin-top:18px;${MF}">
            <div style="font-size:13px;color:#333;margin-bottom:4px;">${lbl}</div>
            <div style="font-size:28px;font-weight:800;color:#FF5D5B;">${totalText}</div>
            ${disc}
        </div>`;
    };

    const contactHTML = () => {
        const nm = partnerName  ? `<div style="font-weight:600;color:#555;font-size:12px;margin-bottom:2px;">${partnerName}</div>` : '';
        const ph = partnerPhone ? `<div style="font-weight:600;font-size:12px;color:#555;margin-bottom:1px;">${partnerPhone}</div>` : '';
        const em = partnerEmail ? `<div style="font-size:11px;color:#555;font-weight:600;">${partnerEmail}</div>` : '';
        if (!nm && !ph && !em) return '';
        return `<div style="margin-top:14px;padding:14px 20px;border:1px solid #ddd;border-radius:14px;display:flex;justify-content:space-between;align-items:center;${MF}">
            <div>
                <div style="color:#FF5D5B;font-weight:800;font-size:14px;margin-bottom:2px;">Как подключиться</div>
                <div style="color:#999;font-size:10px;">Свяжитесь с нами, чтобы подключить сервис</div>
            </div>
            <div style="text-align:right;">${nm}${ph}${em}</div>
        </div>`;
    };

    // Измеряем высоту произвольного HTML в контейнере шириной PAGE_W
    const measureHeight = html => {
        const div = document.createElement('div');
        div.style.cssText = `width:${PAGE_W}px;position:absolute;top:0;left:-9999px;visibility:hidden;`;
        div.innerHTML = html;
        document.body.appendChild(div);
        const h = div.getBoundingClientRect().height;
        document.body.removeChild(div);
        return h;
    };

    // ─── Шаг 1: рендерим header ───────────────────────────────────────────
    const divHeader = document.createElement('div');
    divHeader.style.cssText = `width:${PAGE_W}px;background:#fff;`;
    if (headerSrc) {
        const img = document.createElement('img');
        img.src = headerSrc;
        // Header растягиваем на всю ширину страницы
        img.style.cssText = `width:${PAGE_W}px;display:block;`;
        divHeader.appendChild(img);
    }
    mount(divHeader);
    await Promise.all(Array.from(divHeader.querySelectorAll('img')).map(waitImg));
    await new Promise(r => setTimeout(r, 100));
    const canvasHeader = await toCanvas(divHeader);
    unmount(divHeader);

    // Высота header в DOM-пикселях (при scale=1)
    const headerH_px = Math.round(PAGE_W * canvasHeader.height / canvasHeader.width);

    // ─── Шаг 2: измеряем высоту контента (таблица + итог + контакты) ─────
    const contentBodyHTML = `<div style="padding:20px ${PAD}px 10px;${MF}">
        <h2 style="color:#FF5D5B;font-size:15px;margin:0 0 10px 0;font-weight:800;">Стоимость подключения:</h2>
        <table style="width:100%;border-collapse:collapse;"><tbody>${lines.map(rowHTML).join('')}</tbody></table>
        ${summaryHTML()}
        ${contactHTML()}
    </div>`;
    const contentH_px = measureHeight(contentBodyHTML);

    // ─── Шаг 3: предзагружаем footer-изображения ─────────────────────────
    // Footer: натуральный размер / 1.5 (изображения созданы при DPR=1.5),
    // но не шире contentWidth. Отображаются с паддингом PAD с каждой стороны.
    const contentWidth = PAGE_W - PAD * 2; // 694px
    const FOOTER_SCALE = 1.5;

    const footerNaturalSizes = await Promise.all(footerSrcs.map(src => new Promise(res => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight, ok: true });
        img.onerror = () => res({ w: 0, h: 0, ok: false });
        img.src = src;
    })));
    const footerDisplayHeights = footerNaturalSizes.map(({ w, h }) => {
        if (!w) return 0;
        const dw = Math.min(Math.round(w / FOOTER_SCALE), contentWidth);
        return Math.round(h * dw / w);
    });

    // ─── Шаг 4: считаем, сколько footer-фрагментов влезает на стр1 ───────
    const BOTTOM_PAD = 25;  // отступ между контентом и первым footer-фрагментом
    const FOOTER_GAP = 25;  // отступ между footer-фрагментами (как в референсе)
    let availableForFooter = PAGE_H - headerH_px - contentH_px - BOTTOM_PAD;

    let footerOnP1 = 0;
    let accumulated = 0;
    for (let i = 0; i < footerDisplayHeights.length; i++) {
        if (!footerDisplayHeights[i]) continue;
        const gap = footerOnP1 > 0 ? FOOTER_GAP : 0;
        if (accumulated + gap + footerDisplayHeights[i] <= availableForFooter) {
            accumulated += gap + footerDisplayHeights[i];
            footerOnP1 = i + 1;
        } else {
            break;
        }
    }
    const footerOnP2 = FOOTER_N - footerOnP1;

    // Генератор HTML для footer-фрагментов.
    // Изображения отображаются в размере natural/1.5, но не шире contentWidth.
    // Контейнер с боковыми паддингами PAD px. Между фрагментами отступ FOOTER_GAP px.
    const makeFooterImgsHTML = (from, count) => {
        const items = footerSrcs.slice(from, from + count)
            .map((src, idx) => {
                const nat = footerNaturalSizes[from + idx];
                const imgW = nat && nat.w
                    ? Math.min(Math.round(nat.w / FOOTER_SCALE), contentWidth)
                    : contentWidth;
                const isLast = (idx === count - 1);
                return `<div style="margin-bottom:${isLast ? 0 : FOOTER_GAP}px;">
                    <img src="${src}" crossorigin="anonymous"
                        style="display:block; width:${imgW}px; height:auto;">
                </div>`;
            })
            .join('');
        return `<div style="padding:0 ${PAD}px; box-sizing:border-box;">${items}</div>`;
    };

    // ─── Шаг 5: рендерим контент страницы 1 ──────────────────────────────
    const divContent1 = document.createElement('div');
    divContent1.style.cssText = `width:${PAGE_W}px;background:#fff;`;
    divContent1.innerHTML = `
        <div style="padding:20px ${PAD}px 10px;${MF}">
            <h2 style="color:#FF5D5B;font-size:15px;margin:0 0 10px 0;font-weight:800;">Стоимость подключения:</h2>
            <table style="width:100%;border-collapse:collapse;"><tbody>${lines.map(rowHTML).join('')}</tbody></table>
            ${summaryHTML()}
            ${contactHTML()}
        </div>
        ${footerOnP1 > 0 ? `<div style="margin-top:${BOTTOM_PAD}px;">${makeFooterImgsHTML(0, footerOnP1)}</div>` : ''}
    `;
    mount(divContent1);
    await Promise.all(Array.from(divContent1.querySelectorAll('img')).map(waitImg));
    await new Promise(r => setTimeout(r, 150));
    const canvasContent1 = await toCanvas(divContent1);
    unmount(divContent1);

    // ─── Шаг 6: рендерим страницу 2 (оставшиеся footer-фрагменты) ────────
    let canvas2 = null;
    if (footerOnP2 > 0) {
        const div2 = document.createElement('div');
        div2.style.cssText = `width:${PAGE_W}px;background:#fff;padding-top:40px;`;
        div2.innerHTML = makeFooterImgsHTML(footerOnP1, footerOnP2);
        mount(div2);
        await Promise.all(Array.from(div2.querySelectorAll('img')).map(waitImg));
        await new Promise(r => setTimeout(r, 150));
        canvas2 = await toCanvas(div2);
        unmount(div2);
    }

    // ─── Шаг 7: собираем PDF ──────────────────────────────────────────────
    const pdf = new jsPDFClass({ unit:'pt', format:'a4', orientation:'portrait' });
    const PW = pdf.internal.pageSize.getWidth();   // 595.28pt

    // Страница 1
    const headerH_pt   = PW * (canvasHeader.height / canvasHeader.width);
    const content1H_pt = PW * (canvasContent1.height / canvasContent1.width);
    pdf.addImage(canvasHeader.toDataURL('image/jpeg', 1.0),    'JPEG', 0, 0,          PW, headerH_pt);
    pdf.addImage(canvasContent1.toDataURL('image/jpeg', 1.0), 'JPEG',  0, headerH_pt, PW, content1H_pt);

    // Страница 2 (если нужна)
    if (canvas2) {
        pdf.addPage();
        pdf.addImage(canvas2.toDataURL('image/jpeg', 1.0), 'JPEG',  0, 0, PW, PW * (canvas2.height / canvas2.width));
    }

    const safe = clientName.replace(/[^а-яёА-ЯЁa-zA-Z0-9 _-]/g, '').trim();
    pdf.save(safe ? `КП_1С_Отчетность_${safe}.pdf` : 'КП_1С_Отчетность.pdf');
}

// ─── ПУБЛИЧНЫЙ API ────────────────────────────────────────────────────────

const CalcApp = {
    updateSolo: (f, v) => {
        if (f === 'employees') { STATE.solo.employees = v === "" ? "" : Math.max(0, parseInt(v) || 0); calculate(); }
        else { STATE.solo[f] = v; render(); }
    },
    addFastRow: () => { STATE.fastRows.push({ id: Date.now(), region: '', ulCount: 1, ipCount: 0 }); render(); },
    updateFast: (id, f, v) => {
        const r = STATE.fastRows.find(x => x.id == id);
        if (r) r[f] = f.includes('Count') ? (parseInt(v) || 0) : v;
        calculate();
    },
    removeFast: (id) => {
        if (STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x => x.id != id); render(); }
    },
    addDetailedCompany: () => {
        STATE.detailedCompanies.push({ id: Date.now(), name: '', inn: '', region: '', ownership: 'ul', lk: 'none', multiUser: 'none' });
        render();
    },
    updateDet: (id, f, v, redraw = true) => {
        const c = STATE.detailedCompanies.find(x => x.id == id);
        if (c) { if (f === 'name') v = v.replace(/"([^"]*)"/g, '«$1»').replace(/"/g, '»'); c[f] = v; }
        if (redraw) render(); else calculate();
    },
    removeDet: (id) => {
        if (STATE.detailedCompanies.length > 1) { STATE.detailedCompanies = STATE.detailedCompanies.filter(x => x.id != id); render(); }
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
            const cb = card.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = STATE.addons[id].enabled;
        }
        calculate();
    },
    updateAddonValue: (aId, iId, val) => { STATE.addons[aId].values[iId] = parseInt(val) || 0; calculate(); },
    updateCustomPrice: (col, val) => {
        if (val === "") { delete STATE.customPrices[col]; }
        else { STATE.customPrices[col] = parseInt(val.toString().replace(/\D/g, '')) || 0; }
        localStorage.setItem('my_custom_prices', JSON.stringify(STATE.customPrices));
        calculate();
    },
    updateSoloEmployees: (val) => {
        const clean = val.toString().replace(/\D/g, '');
        STATE.solo.employees = clean === "" ? "" : parseInt(clean);
        calculate();
    }
};

window.CalcApp = CalcApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initPDF(); });
} else {
    init();
    initPDF();
}

})();