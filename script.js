/**
 * 1. КОНФИГУРАЦИЯ
 * Здесь храним названия колонок JSON и настройки.
 * Если изменятся названия в файле, правим только здесь.
 */
const CONFIG = {
    columns: {
        ul_base: 'ЮЛ',                         // Цена ЮЛ 1 год
        ip_base: 'ИП',                         // Цена ИП 1 год
        ul_2year: 'Column4',                   // Цена ЮЛ 2 года
        ip_2year: 'Column13',                  // Цена ИП 2 года
        multi_small: 'Многопользовательский режим', // Доп: 2-9 пользователей
        multi_large: 'Column29',                   // Доп: 10+ пользователей
        lk_base: 'Column31',                       // Доп: ЛК Базовый
        lk_prof: 'Column33'                        // Доп: ЛК Проф
    },
    // Список дополнительных услуг для перебора в цикле (убирает дублирование if-ов)
    extraServices: [
        { key: 'lk', val: 'base', col: 'lk_base', label: 'ЛК Базовый' },
        { key: 'lk', val: 'prof', col: 'lk_prof', label: 'ЛК Проф' },
        { key: 'multiUser', val: 'small', col: 'multi_small', label: 'Многопольз. (2-9)' },
        { key: 'multiUser', val: 'large', col: 'multi_large', label: 'Многопольз. (10+)' }
    ]
};

/**
 * 2. СОСТОЯНИЕ (STATE)
 */
const STATE = {
    tariffs: [],      // Исходный массив из JSON (для построения select)
    tariffMap: {},    // Оптимизация: объект { "77": { ...данные... } } для быстрого поиска
    isGroup: false,
    mode: 'fast', 
    existingCount: 0,
    solo: { region: '', ownership: 'ul', duration: '1', employees: 1 },
    fastRows: [{ id: Date.now(), region: '', ulCount: 1, ipCount: 0 }],
    detailedCompanies: [{ id: Date.now(), name: '', inn: '', region: '', ownership: 'ul', lk: 'none', multiUser: 'none' }],
    manualDiscount: { type: 'percent', value: 0 }
};

// Форматирование цены
const formatPrice = (v) => Math.round(v).toLocaleString('ru-RU') + ' ₽';

// Получение цены из объекта тарифа по ключу из конфига
const getPrice = (tariff, configKey) => {
    const columnName = CONFIG.columns[configKey];
    return parseInt(tariff[columnName]) || 0;
};

// Генерация списка регионов <option>
const getRegionOptions = (selected) => {
    let options = `<option value="" ${!selected ? 'selected' : ''} disabled>Выберите регион</option>`;
    options += STATE.tariffs.map(t => `<option value="${t.Код}" ${selected == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('');
    return options;
};

/**
 * 3. ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Восстановление телефона/email
    const fields = ['partner-phone', 'partner-email'];
    fields.forEach(id => {
        const saved = localStorage.getItem(`p-${id}`);
        const el = document.getElementById(id);
        if (saved && el) el.value = saved;
        if (el) el.oninput = (e) => localStorage.setItem(`p-${id}`, e.target.value);
    });

    // Настройка ручной скидки
    const discType = document.getElementById('manual-disc-type');
    const discVal = document.getElementById('manual-disc-val');
    
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

    // Загрузка данных
    try {
        const res = await fetch('Цены для Калькулятора 1СО.json');
        const data = await res.json();
        // Сохраняем массив для рендера списков
        STATE.tariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
        // Создаем карту для быстрого поиска в calculate()
        STATE.tariffMap = Object.fromEntries(STATE.tariffs.map(t => [t.Код, t]));
        
        setupEventListeners();
        render();
    } catch (e) { console.error("Ошибка загрузки данных:", e); }
});

function validateManualDiscount(input) {
    if (!input) return;
    if (STATE.manualDiscount.type === 'percent') {
        let val = parseFloat(input.value);
        if (val < 0) input.value = 0;
        if (val > 100) input.value = 100;
    }
}

function setupEventListeners() {
    // Переключение Главная / Группа
    document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.isGroup = e.target.dataset.value === 'yes';
            const container = document.getElementById('mode-selection-container');
            if(container) container.style.display = STATE.isGroup ? 'block' : 'none';
            render();
        };
    });

    // Переключение табов внутри Группы
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.mode = e.target.dataset.mode;
            render();
        };
    });
}

/**
 * 4. РЕНДЕРИНГ
 */
function render() {
    const container = document.getElementById('dynamic-fields');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!STATE.isGroup) {
        renderSoloMode(container);
    } else {
        if (STATE.mode === 'addon') renderDetailedMode(container, true);
        else if (STATE.mode === 'detailed') renderDetailedMode(container, false);
        else renderFastGroupMode(container);
    }
    calculate();
}

function renderSoloMode(container) {
    const tpl = document.getElementById('tpl-solo-mode');
    if (!tpl) return;
    const content = tpl.content.cloneNode(true);
    
    const regSelect = content.getElementById('s-reg');
    if (regSelect) {
        regSelect.innerHTML = getRegionOptions(STATE.solo.region);
        regSelect.onchange = (e) => updateSolo('region', e.target.value);
    }

    // Подсветка кнопок
    content.querySelectorAll('#solo-ownership .toggle-btn').forEach(b => {
        if(b.dataset.val === STATE.solo.ownership) b.classList.add('selected');
        b.onclick = () => updateSolo('ownership', b.dataset.val);
    });

    content.querySelectorAll('#solo-duration .toggle-btn').forEach(b => {
        if(b.dataset.val === STATE.solo.duration) b.classList.add('selected');
        b.onclick = () => updateSolo('duration', b.dataset.val);
    });

    const empInput = content.getElementById('solo-employees');
    if (empInput) {
        empInput.value = STATE.solo.employees;
        empInput.oninput = (e) => updateSolo('employees', e.target.value);
    }

    container.appendChild(content);
}

function renderFastGroupMode(container) {
    const tpl = document.getElementById('tpl-fast-mode');
    if (!tpl) return;
    const content = tpl.content.cloneNode(true);
    const rowsCont = content.getElementById('f-rows');

    STATE.fastRows.forEach(row => {
        const div = document.createElement('div');
        div.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";
        div.innerHTML = `
            <select onchange="window.updateFast(${row.id},'region',this.value)">${getRegionOptions(row.region)}</select>
            <input type="number" value="${row.ulCount}" oninput="window.updateFast(${row.id},'ulCount',this.value)" style="text-align: center;">
            <input type="number" value="${row.ipCount}" oninput="window.updateFast(${row.id},'ipCount',this.value)" style="text-align: center;">
            <button onclick="window.removeFast(${row.id})" style="color:#ccc; background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>`;
        rowsCont.appendChild(div);
    });
    container.appendChild(content);
}

function renderDetailedMode(container, showExisting) {
    const mainTpl = document.getElementById('tpl-detailed-mode');
    if (!mainTpl) return;
    const content = mainTpl.content.cloneNode(true);
    
    if (showExisting) {
        const row = content.getElementById('existing-count-row');
        if (row) row.style.display = 'flex';
        const inp = content.getElementById('existing-input');
        if (inp) {
            inp.value = STATE.existingCount;
            inp.oninput = (e) => { STATE.existingCount = parseInt(e.target.value) || 0; calculate(); };
        }
    }

    const cardsContainer = content.getElementById('det-cards');

    STATE.detailedCompanies.forEach((comp, idx) => {
        const cardTpl = document.getElementById('tpl-company-card');
        if (!cardTpl) return;
        const cardContent = cardTpl.content.cloneNode(true);
        
        // Поле названия
        const nameInp = cardContent.querySelector('.comp-name-input');
        nameInp.value = comp.name;
        nameInp.oninput = (e) => window.updateDet(comp.id, 'name', e.target.value, false);

        // Поле ИНН
        const innInp = cardContent.querySelector('.comp-inn-input');
        innInp.value = comp.inn;
        innInp.style.borderColor = (comp.inn.length === 0 || [10, 12].includes(comp.inn.length)) ? '' : 'red';
        innInp.oninput = (e) => window.updateDet(comp.id, 'inn', e.target.value, false);

        // Селект региона
        const regSel = cardContent.querySelector('.comp-region-select');
        regSel.innerHTML = getRegionOptions(comp.region);
        regSel.onchange = (e) => window.updateDet(comp.id, 'region', e.target.value);

        // Кнопки ЮЛ/ИП
        cardContent.querySelectorAll('.ownership-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.ownership) btn.classList.add('selected');
            btn.onclick = () => window.updateDet(comp.id, 'ownership', btn.dataset.val);
        });

        // Кнопки ЛК
        cardContent.querySelectorAll('.lk-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.lk) btn.classList.add('selected');
            btn.onclick = () => window.toggleOption(comp.id, 'lk', btn.dataset.val);
        });

        // Кнопки Многопользовательского режима
        cardContent.querySelectorAll('.multi-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.multiUser) btn.classList.add('selected');
            btn.onclick = () => window.toggleOption(comp.id, 'multiUser', btn.dataset.val);
        });

        // Кнопка удаления
        if (idx > 0) {
            const delBtn = cardContent.querySelector('.remove-card-btn');
            if (delBtn) {
                delBtn.style.display = 'block';
                delBtn.onclick = () => window.removeDet(comp.id);
            }
        }

        cardsContainer.appendChild(cardContent);
    });

    container.innerHTML = '';
    container.appendChild(content);
}

/**
 * 5. ЛОГИКА РАСЧЕТОВ (Оптимизированная)
 */
function calculate() {
    let total = 0;              // Итоговая сумма
    let discBaseTotal = 0;      // Базовая сумма для расчета % скидки
    let discCurrentTotal = 0;   // Сумма со скидкой ГК
    let logs = [];              // Детализация

    const ui = { 
        price: document.getElementById('total-price'), 
        details: document.getElementById('details-content'), 
        discount: document.getElementById('discount-info') 
    };

    if (!ui.price || !ui.details || !ui.discount) return;

    // --- РЕЖИМ: ОДИНОЧНАЯ ОРГАНИЗАЦИЯ ---
    if (!STATE.isGroup) {
        ui.discount.style.display = 'none';
        
        // Используем карту для быстрого доступа
        const t = STATE.tariffMap[STATE.solo.region];
        
        if (t) {
            const isTwo = STATE.solo.duration === '2';
            const isUL = STATE.solo.ownership === 'ul';
            
            // Выбираем правильную колонку из конфига
            const mainPriceKey = isUL ? (isTwo ? 'ul_2year' : 'ul_base') : (isTwo ? 'ip_2year' : 'ip_base');
            const price = getPrice(t, mainPriceKey);
            
            total += price;
            logs.push(`Лицензия ${isUL ? 'ЮЛ' : 'ИП'}, ${t.Регион}, ${isTwo ? '2 года' : '1 год'} | ${formatPrice(price)}`);

            // Доп. опция: Многопользовательский режим
            let multiKey = null;
            if (STATE.solo.employees >= 2 && STATE.solo.employees <= 9) multiKey = 'multi_small';
            else if (STATE.solo.employees >= 10) multiKey = 'multi_large';

            if (multiKey) {
                const pMulti = getPrice(t, multiKey);
                total += pMulti;
                logs.push(`${CONFIG.extraServices.find(s => s.col === multiKey).label} | ${formatPrice(pMulti)}`);
            }
        }
    } 
    // --- РЕЖИМ: ГРУППА КОМПАНИЙ (ГК) ---
    else {
        // Подсчет кол-ва
        const count = (STATE.mode === 'addon' ? STATE.existingCount : 0) + 
                      (STATE.mode === 'fast' ? STATE.fastRows.reduce((a, b) => a + (parseInt(b.ulCount)||0) + (parseInt(b.ipCount)||0), 0) : STATE.detailedCompanies.length);
        
        if (count < 3) {
            ui.price.textContent = "Мин. 3 орг."; 
            ui.details.innerText = "Нужно минимум 3 организации."; 
            return;
        }

        ui.discount.style.display = 'block';
        const col = getGroupColumnKey(count); // Колонки скидок (Column5...Column20)

        // 1. Быстрый ввод
        if (STATE.mode === 'fast') {
            STATE.fastRows.forEach(r => {
                const t = STATE.tariffMap[r.region]; if (!t) return;
                
                // ЮЛ
                if (r.ulCount > 0) {
                    const pGK = parseInt(t[col.ul]) || 0;
                    const pBase = getPrice(t, 'ul_base');
                    total += pGK * r.ulCount;
                    discCurrentTotal += pGK * r.ulCount;
                    discBaseTotal += pBase * r.ulCount;
                    logs.push(`ЮЛ (${t.Регион}) | ${formatPrice(pGK)} x ${r.ulCount} | ${formatPrice(pGK * r.ulCount)}`);
                }
                // ИП
                if (r.ipCount > 0) {
                    const pGK = parseInt(t[col.ip]) || 0;
                    const pBase = getPrice(t, 'ip_base');
                    total += pGK * r.ipCount;
                    discCurrentTotal += pGK * r.ipCount;
                    discBaseTotal += pBase * r.ipCount;
                    logs.push(`ИП (${t.Регион}) | ${formatPrice(pGK)} x ${r.ipCount} | ${formatPrice(pGK * r.ipCount)}`);
                }
            });
        } 
        // 2. Детальный ввод
        else {
            STATE.detailedCompanies.forEach(c => {
                const t = STATE.tariffMap[c.region]; if (!t) return;
                
                const isUL = c.ownership === 'ul';
                const pGK = parseInt(t[isUL ? col.ul : col.ip]) || 0;
                const pBase = getPrice(t, isUL ? 'ul_base' : 'ip_base');
                const compName = c.name || 'Организация';

                logs.push(`${compName} (${isUL ? 'ЮЛ' : 'ИП'}, ${t.Регион}) | ${formatPrice(pGK)}`);

                total += pGK;
                discCurrentTotal += pGK;
                discBaseTotal += pBase;

                // Перебор доп. услуг через CONFIG (без дублирования if-ов)
                CONFIG.extraServices.forEach(srv => {
                    if (c[srv.key] === srv.val) {
                        const srvPrice = getPrice(t, srv.col);
                        total += srvPrice;
                        logs.push(`      ${compName} - ${srv.label} | ${formatPrice(srvPrice)}`);
                    }
                });
            });
        }
        
        // Расчет % скидки
        const pct = discBaseTotal > 0 ? Math.round(((discBaseTotal - discCurrentTotal) / discBaseTotal) * 100) : 0;
        ui.discount.innerHTML = `Скидка ГК: ${pct}% ⓘ`;
    }

    // --- РУЧНАЯ СКИДКА ---
    let finalTotal = total;
    if (STATE.manualDiscount.value > 0) {
        let discAmount = STATE.manualDiscount.type === 'percent' 
            ? total * (STATE.manualDiscount.value / 100) 
            : STATE.manualDiscount.value;
            
        logs.push(`Доп. скидка ${STATE.manualDiscount.type === 'percent' ? STATE.manualDiscount.value + '%' : '(руб)'} | -${formatPrice(discAmount)}`);
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
 * 6. ГЕНЕРАЦИЯ PDF - Будет переделана под другой дизайн
 */
const pdfBtn = document.getElementById('generate-pdf');
if (pdfBtn) {
    pdfBtn.onclick = function() {
        const createPdfBlock = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const clone = el.cloneNode(true);
            clone.classList.add('pdf-dynamic-el');
            clone.style.pageBreakInside = 'avoid'; 
            clone.style.display = 'block';
            return clone;
        };

        try {
            window.scrollTo(0, 0);
            const wrapper = document.getElementById('pdf-container-wrapper');
            const template = document.getElementById('pdf-template');
            const page1 = document.getElementById('page-1');
            const page2 = document.getElementById('page-2');
            const pageLast = document.getElementById('page-last');

            const page2Copy = page2.cloneNode(true);
            const pageLastCopy = pageLast.cloneNode(true);

            document.querySelectorAll('.pdf-dynamic-el').forEach(el => el.remove());
            
            const summary = createPdfBlock('summary-block');
            summary.querySelector('.pdf-total-val').innerText = document.getElementById('total-price').innerText;
            
            const disc = document.getElementById('discount-info');
            if (disc?.offsetParent) summary.querySelector('.pdf-discount-val').innerText = disc.innerText.replace('ⓘ', '');

            const contactSource = document.getElementById('contact-box-template');
            const contact1 = contactSource.cloneNode(true);
            contact1.classList.add('pdf-dynamic-el');
            contact1.style.display = 'flex';
            contact1.style.pageBreakInside = 'avoid';
            contact1.querySelector('.c-phone').innerText = document.getElementById('partner-phone').value;
            contact1.querySelector('.c-email').innerText = document.getElementById('partner-email').value;
            
            const contact2 = contact1.cloneNode(true);

            const finalImg = document.createElement('img');
            finalImg.src = "pdf-footer.jpg";
            finalImg.style = "width:100%; display:block; margin-top: 15px; page-break-inside: avoid;";
            finalImg.classList.add('pdf-dynamic-el');

            // В PDF убираем отступы (trim) чтобы сохранить исходный вид
            const lines = document.getElementById('details-content').innerText.split('\n').filter(l => l.trim());
            const rows1 = document.getElementById('pdf-rows');
            const rows2 = page2.querySelector('#pdf-rows-p2');
            
            rows1.innerHTML = ''; 
            if (rows2) rows2.innerHTML = '';

            lines.forEach((line, idx) => {
                const cleanLine = line.trim(); // Очистка отступов для PDF
                const tr = document.createElement('tr');
                if (cleanLine.includes('|')) {
                    const parts = cleanLine.split('|');
                    const t = parts.length > 2 ? parts[0] + ' | ' + parts[1] : parts[0];
                    const p = parts[parts.length - 1];
                    tr.innerHTML = `<td style="padding:5px 0; border-bottom:1px solid #eee; font-size:10pt;">${t.trim()}</td>
                                    <td style="padding:5px 0; border-bottom:1px solid #eee; text-align:right; font-weight:700; color:#FF5D5B; font-size:10pt;">${p.trim()}</td>`;
                } else {
                    tr.innerHTML = `<td colspan="2" style="padding:5px 0; font-size:9pt; color:#666;">${cleanLine}</td>`;
                }
                if (idx < 10) rows1.appendChild(tr); else if (rows2) rows2.appendChild(tr);
            });

            const placeP1 = document.getElementById('res-place-p1');
            const placeP2 = page2.querySelector('#res-place-p2');
            placeP1.innerHTML = '';
            if (placeP2) placeP2.innerHTML = '';
            pageLast.innerHTML = '';

            if (lines.length > 5) {
                pageLast.remove();
                page2.style.display = 'block';
                if (lines.length >= 10 && placeP2) placeP2.appendChild(summary); else placeP1.appendChild(summary);
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
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true },
                jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
            }).from(template).save().then(() => {
                wrapper.style.display = 'none';
                template.innerHTML = '';
                template.appendChild(page1);
                template.appendChild(page2Copy);
                template.appendChild(pageLastCopy);
            });

        } catch (e) { console.error("Ошибка PDF:", e); }
    };
}

/**
 * 7. ФУНКЦИИ ОБНОВЛЕНИЯ (Window Scope)
 */
window.updateSolo = (f, v) => { STATE.solo[f] = f === 'employees' ? parseInt(v)||1 : v; render(); };
window.addFastRow = () => { STATE.fastRows.push({id:Date.now(), region:'', ulCount:1, ipCount:0}); render(); };
window.updateFast = (id, f, v) => { const r = STATE.fastRows.find(x=>x.id==id); if(r) r[f] = f.includes('Count') ? (parseInt(v)||0) : v; calculate(); };
window.removeFast = (id) => { if(STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x=>x.id!=id); render(); } };

window.addDetailedCompany = () => { STATE.detailedCompanies.push({id:Date.now(), name:'', inn:'', region:'', ownership:'ul', lk:'none', multiUser:'none'}); render(); };

window.updateDet = (id, f, v, redraw = true) => { 
    const c = STATE.detailedCompanies.find(x => x.id == id); 
    if (c) {
        if (f === 'name') {
            v = v.replace(/"([^"]*)"/g, '«$1»').replace(/"/g, '»');
        }
        c[f] = v;
    }
    if (redraw) render(); else calculate(); 
};

window.removeDet = (id) => { if(STATE.detailedCompanies.length > 1) { STATE.detailedCompanies = STATE.detailedCompanies.filter(x=>x.id!=id); render(); } };

window.toggleOption = (id, field, value) => { 
    const c = STATE.detailedCompanies.find(x=>x.id==id); if(!c) return;
    c[field] = c[field] === value ? 'none' : value;
    if (field === 'lk' && c[field] !== 'none') c.multiUser = 'none'; 
    if (field === 'multiUser' && c[field] !== 'none') c.lk = 'none'; 
    render(); 
};