/**
 * КОНФИГУРАЦИЯ И СОСТОЯНИЕ
 */
const STATE = {
    tariffs: [],
    isGroup: false,
    mode: 'fast', 
    existingCount: 0,
    solo: { region: '', ownership: 'ul', duration: '1', employees: 1 },
    fastRows: [{ id: Date.now(), region: '', ulCount: 1, ipCount: 0 }],
    detailedCompanies: [{ id: Date.now(), name: '', inn: '', region: '', ownership: 'ul', lk: 'none', multiUser: 'none' }],
    manualDiscount: { type: 'percent', value: 0 }
};

const formatPrice = (v) => Math.round(v).toLocaleString('ru-RU') + ' ₽';

const getRegionOptions = (selected) => {
    let options = `<option value="" ${!selected ? 'selected' : ''} disabled>Выберите регион</option>`;
    options += STATE.tariffs.map(t => `<option value="${t.Код}" ${selected == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('');
    return options;
};

/**
 * ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', async () => {
    const fields = ['partner-phone', 'partner-email'];
    fields.forEach(id => {
        const saved = localStorage.getItem(`p-${id}`);
        if (saved) document.getElementById(id).value = saved;
        document.getElementById(id).oninput = (e) => localStorage.setItem(`p-${id}`, e.target.value);
    });

    const discType = document.getElementById('manual-disc-type');
    const discVal = document.getElementById('manual-disc-val');
    
    discType.onchange = (e) => {
        STATE.manualDiscount.type = e.target.value;
        validateManualDiscount(discVal);
        calculate();
    };

    discVal.oninput = (e) => {
        validateManualDiscount(e.target);
        STATE.manualDiscount.value = parseFloat(e.target.value) || 0;
        calculate();
    };

    try {
        const res = await fetch('Цены для Калькулятора 1СО.json');
        const data = await res.json();
        STATE.tariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
        setupEventListeners();
        render();
    } catch (e) { console.error("Ошибка загрузки данных:", e); }
});

function validateManualDiscount(input) {
    if (STATE.manualDiscount.type === 'percent') {
        let val = parseFloat(input.value);
        if (val < 0) input.value = 0;
        if (val > 100) input.value = 100;
    }
}

function setupEventListeners() {
    document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.isGroup = e.target.dataset.value === 'yes';
            document.getElementById('mode-selection-container').style.display = STATE.isGroup ? 'block' : 'none';
            render();
        };
    });
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
 * РЕНДЕРИНГ
 */
function render() {
    const container = document.getElementById('dynamic-fields');
    container.innerHTML = '';
    if (!STATE.isGroup) renderSoloMode(container);
    else {
        if (STATE.mode === 'addon') renderDetailedMode(container, true);
        else if (STATE.mode === 'detailed') renderDetailedMode(container, false);
        else renderFastGroupMode(container);
    }
    calculate();
}

function renderSoloMode(container) {
    const tpl = document.getElementById('tpl-solo-mode').content.cloneNode(true);
    
    const regSelect = tpl.getElementById('s-reg');
    regSelect.innerHTML = getRegionOptions(STATE.solo.region);
    regSelect.onchange = (e) => updateSolo('region', e.target.value);

    // Подсветка кнопок
    tpl.querySelectorAll('#solo-ownership .toggle-btn').forEach(b => {
        if(b.dataset.val === STATE.solo.ownership) b.classList.add('selected');
        b.onclick = () => updateSolo('ownership', b.dataset.val);
    });

    tpl.querySelectorAll('#solo-duration .toggle-btn').forEach(b => {
        if(b.dataset.val === STATE.solo.duration) b.classList.add('selected');
        b.onclick = () => updateSolo('duration', b.dataset.val);
    });

    const empInput = tpl.getElementById('solo-employees');
    empInput.value = STATE.solo.employees;
    empInput.oninput = (e) => updateSolo('employees', e.target.value);

    container.appendChild(tpl);
}

function renderFastGroupMode(container) {
    const tpl = document.getElementById('tpl-fast-mode').content.cloneNode(true);
    const rowsCont = tpl.getElementById('f-rows');

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
    container.appendChild(tpl);
}

function renderDetailedMode(container, showExisting) {
    const mainTpl = document.getElementById('tpl-detailed-mode').content.cloneNode(true);
    
    // 1. Обработка блока "Уже подключено"
    if (showExisting) {
        mainTpl.getElementById('existing-count-row').style.display = 'flex';
        const inp = mainTpl.getElementById('existing-input');
        inp.value = STATE.existingCount;
        inp.oninput = (e) => { STATE.existingCount = parseInt(e.target.value) || 0; calculate(); };
    }

    const cardsContainer = mainTpl.getElementById('det-cards');

    // 2. Цикл по компаниям с использованием шаблона карточки
    STATE.detailedCompanies.forEach((comp, idx) => {
        const cardTpl = document.getElementById('tpl-company-card').content.cloneNode(true);
        const cardDiv = cardTpl.querySelector('.company-card');

        // Поле названия (безопасная установка)
        const nameInp = cardTpl.querySelector('.comp-name-input');
        nameInp.value = comp.name;
        nameInp.oninput = (e) => window.updateDet(comp.id, 'name', e.target.value, false);

        // Поле ИНН
        const innInp = cardTpl.querySelector('.comp-inn-input');
        innInp.value = comp.inn;
        innInp.style.borderColor = (comp.inn.length === 0 || [10, 12].includes(comp.inn.length)) ? '' : 'red';
        innInp.oninput = (e) => window.updateDet(comp.id, 'inn', e.target.value, false);

        // Селект региона
        const regSel = cardTpl.querySelector('.comp-region-select');
        regSel.innerHTML = getRegionOptions(comp.region);
        regSel.onchange = (e) => window.updateDet(comp.id, 'region', e.target.value);

        // Кнопки ЮЛ/ИП
        cardTpl.querySelectorAll('.ownership-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.ownership) btn.classList.add('selected');
            btn.onclick = () => window.updateDet(comp.id, 'ownership', btn.dataset.val);
        });

        // Кнопки ЛК
        cardTpl.querySelectorAll('.lk-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.lk) btn.classList.add('selected');
            btn.onclick = () => window.toggleOption(comp.id, 'lk', btn.dataset.val);
        });

        // Кнопки Многопользовательского режима
        cardTpl.querySelectorAll('.multi-group .toggle-btn').forEach(btn => {
            if (btn.dataset.val === comp.multiUser) btn.classList.add('selected');
            btn.onclick = () => window.toggleOption(comp.id, 'multiUser', btn.dataset.val);
        });

        // Кнопка удаления (показываем только если карточек больше одной)
        if (idx > 0) {
            const delBtn = cardTpl.querySelector('.remove-card-btn');
            delBtn.style.display = 'block';
            delBtn.onclick = () => window.removeDet(comp.id);
        }

        cardsContainer.appendChild(cardTpl);
    });

    container.innerHTML = ''; // Очищаем контейнер перед вставкой
    container.appendChild(mainTpl);
}

/**
 * ЛОГИКА РАСЧЕТОВ
 */
function calculate() {
    let total = 0; 
    let discountableBaseTotal = 0; 
    let discountableTotal = 0;     

    let logs = [];
    const ui = { price: document.getElementById('total-price'), details: document.getElementById('details-content'), discount: document.getElementById('discount-info') };

    if (!STATE.isGroup) {
        ui.discount.style.display = 'none';
        const t = STATE.tariffs.find(x => x.Код == STATE.solo.region);
        if (t) {
            const isTwo = STATE.solo.duration === '2';
            const typeLabel = STATE.solo.ownership === 'ul' ? 'ЮЛ' : 'ИП';
            const p = (STATE.solo.ownership === 'ul') ? (isTwo ? t.Column4 : t.ЮЛ) : (isTwo ? t.Column13 : t.ИП);
            total += parseInt(p) || 0;
            logs.push(`Лицензия ${typeLabel}, ${t.Регион}, ${isTwo?'2 года':'1 год'} | ${formatPrice(p)}`);

            if (STATE.solo.employees >= 2 && STATE.solo.employees <= 9) {
                const pMulti = parseInt(t['Многопользовательский режим']) || 0;
                total += pMulti;
                logs.push(`Многопользовательский режим (2-9 чел) | ${formatPrice(pMulti)}`);
            } else if (STATE.solo.employees >= 10) {
                const pMulti = parseInt(t['Column29']) || 0;
                total += pMulti;
                logs.push(`Многопользовательский режим (10+ чел) | ${formatPrice(pMulti)}`);
            }
        }
    } else {
        const count = (STATE.mode === 'addon' ? STATE.existingCount : 0) + 
                      (STATE.mode === 'fast' ? STATE.fastRows.reduce((a, b) => a + (parseInt(b.ulCount)||0) + (parseInt(b.ipCount)||0), 0) : STATE.detailedCompanies.length);
        
        if (count < 3) {
            ui.price.textContent = "Мин. 3 орг."; ui.details.innerText = "Нужно минимум 3 организации."; return;
        }

        ui.discount.style.display = 'block';
        const col = getGroupColumnKey(count);

        if (STATE.mode === 'fast') {
            STATE.fastRows.forEach(r => {
                const t = STATE.tariffs.find(x => x.Код == r.region); if (!t) return;
                const pUL = parseInt(t[col.ul]) || 0, pIP = parseInt(t[col.ip]) || 0;
                const baseUL = parseInt(t.ЮЛ) || 0, baseIP = parseInt(t.ИП) || 0;

                if (r.ulCount > 0) { 
                    const sum = pUL * r.ulCount; 
                    total += sum; 
                    discountableTotal += sum;
                    discountableBaseTotal += baseUL * r.ulCount;
                    logs.push(`ЮЛ (${t.Регион}) | ${formatPrice(pUL)} x ${r.ulCount} | ${formatPrice(sum)}`); 
                }
                if (r.ipCount > 0) { 
                    const sum = pIP * r.ipCount; 
                    total += sum;
                    discountableTotal += sum;
                    discountableBaseTotal += baseIP * r.ipCount;
                    logs.push(`ИП (${t.Регион}) | ${formatPrice(pIP)} x ${r.ipCount} | ${formatPrice(sum)}`); 
                }
            });
        } else {
            STATE.detailedCompanies.forEach(c => {
                const t = STATE.tariffs.find(x => x.Код == c.region); if (!t) return;
                const typeLabel = c.ownership === 'ul' ? 'ЮЛ' : 'ИП';
                const pGK = parseInt(t[c.ownership === 'ul' ? col.ul : col.ip]) || 0;
                const pBase = parseInt(c.ownership === 'ul' ? t.ЮЛ : t.ИП) || 0;
                const compName = c.name || 'Орг';
                
                // Добавляем лицензию ПЕРВОЙ в список для компании
                logs.push(`${compName} (${typeLabel}, ${t.Регион}) | ${formatPrice(pGK)}`);

                total += pGK;
                discountableTotal += pGK;
                discountableBaseTotal += pBase;
                
                // Допы теперь с отступом (в интерфейсе)
                if (c.lk === 'base') { total += 600; logs.push(`      ${compName} - ЛК Базовый | ${formatPrice(600)}`); }
                if (c.lk === 'prof') { total += 900; logs.push(`      ${compName} - ЛК Проф | ${formatPrice(900)}`); }
                if (c.multiUser === 'small') { total += 1620; logs.push(`      ${compName} - Многопольз. (2-9) | ${formatPrice(1620)}`); }
                if (c.multiUser === 'large') { total += 3240; logs.push(`      ${compName} - Многопольз. (10+) | ${formatPrice(3240)}`); }
            });
        }
        
        const pct = discountableBaseTotal > 0 ? Math.round(((discountableBaseTotal - discountableTotal) / discountableBaseTotal) * 100) : 0;
        ui.discount.innerHTML = `Скидка ГК: ${pct}% ⓘ`;
    }

    let finalTotal = total;
    if (STATE.manualDiscount.value > 0) {
        let discAmount = 0;
        if (STATE.manualDiscount.type === 'percent') {
            discAmount = total * (STATE.manualDiscount.value / 100);
            logs.push(`Доп. скидка ${STATE.manualDiscount.value}% | -${formatPrice(discAmount)}`);
        } else {
            discAmount = STATE.manualDiscount.value;
            logs.push(`Доп. скидка (руб) | -${formatPrice(discAmount)}`);
        }
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
 * ГЕНЕРАЦИЯ PDF
 */
document.getElementById('generate-pdf').onclick = function() {
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

/**
 * ФУНКЦИИ ОБНОВЛЕНИЯ
 */
window.updateSolo = (f, v) => { STATE.solo[f] = f === 'employees' ? parseInt(v)||1 : v; render(); };
window.addFastRow = () => { STATE.fastRows.push({id:Date.now(), region:'', ulCount:1, ipCount:0}); render(); };
window.updateFast = (id, f, v) => { const r = STATE.fastRows.find(x=>x.id==id); if(r) r[f] = f.includes('Count') ? (parseInt(v)||0) : v; calculate(); };
window.removeFast = (id) => { if(STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x=>x.id!=id); render(); } };

window.addDetailedCompany = () => { STATE.detailedCompanies.push({id:Date.now(), name:'', inn:'', region:'', ownership:'ul', lk:'none', multiUser:'none'}); render(); };

// Изменено: redraw=false для текстовых полей, чтобы не сбрасывать фокус и не обрезать ввод
window.updateDet = (id, f, v, redraw = true) => { 
    const c = STATE.detailedCompanies.find(x => x.id == id); 
    if (c) {
        // Автоматическая замена обычных кавычек на "елочки" для красоты
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