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
    container.innerHTML = `
        <div class="form-row"><label>Регион</label><select id="s-reg">${getRegionOptions(STATE.solo.region)}</select></div>
        <div class="grid-adaptive" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><label>Тип</label><div class="toggle-group">
                <button class="toggle-btn ${STATE.solo.ownership==='ul'?'selected':''}" onclick="updateSolo('ownership','ul')">ЮЛ</button>
                <button class="toggle-btn ${STATE.solo.ownership==='ip'?'selected':''}" onclick="updateSolo('ownership','ip')">ИП</button>
            </div></div>
            <div><label>Срок</label><div class="toggle-group">
                <button class="toggle-btn ${STATE.solo.duration==='1'?'selected':''}" onclick="updateSolo('duration','1')">1 год</button>
                <button class="toggle-btn ${STATE.solo.duration==='2'?'selected':''}" onclick="updateSolo('duration','2')">2 года</button>
            </div></div>
        </div>
        <div class="form-row" style="margin-top:15px;">
            <label>Сотрудников с сертификатом:</label>
            <input type="number" value="${STATE.solo.employees}" min="1" oninput="updateSolo('employees', this.value)">
        </div>`;
    document.getElementById('s-reg').onchange = (e) => updateSolo('region', e.target.value);
}

function renderFastGroupMode(container) {
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 5px; opacity: 0.6; font-size: 11px; font-weight: 700;">
            <div>РЕГИОН</div><div style="text-align:center">ЮЛ</div><div style="text-align:center">ИП</div><div></div>
        </div>
        <div id="f-rows"></div>
        <button class="submit-btn" style="background:#FF5D5B; margin-top:10px;" onclick="addFastRow()">+ Добавить регион</button>`;

    STATE.fastRows.forEach(row => {
        const div = document.createElement('div');
        div.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";
        div.innerHTML = `
            <select onchange="window.updateFast(${row.id},'region',this.value)">${getRegionOptions(row.region)}</select>
            <input type="number" value="${row.ulCount}" oninput="window.updateFast(${row.id},'ulCount',this.value)" style="text-align: center;">
            <input type="number" value="${row.ipCount}" oninput="window.updateFast(${row.id},'ipCount',this.value)" style="text-align: center;">
            <button onclick="window.removeFast(${row.id})" style="color:#ccc; background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>`;
        document.getElementById('f-rows').appendChild(div);
    });
}

function renderDetailedMode(container, showExisting) {
    let html = showExisting ? `
        <div class="form-row" style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
            <label>Уже подключено компаний в ГК</label>
            <input type="number" min="0" value="${STATE.existingCount}" style="width: 100px; text-align: center;" oninput="let v=parseInt(this.value)||0; if(v<0) v=0; STATE.existingCount=v; this.value=v; calculate()">
        </div>` : '';
    html += `<div id="det-cards"></div><button class="submit-btn" style="background: #FF5D5B;" onclick="addDetailedCompany()">+ Добавить компанию</button>`;
    container.innerHTML = html;

    const cardsContainer = document.getElementById('det-cards');

    STATE.detailedCompanies.forEach((comp, idx) => {
        const isInnValid = comp.inn.length === 0 || comp.inn.length === 10 || comp.inn.length === 12;
        const innBorder = isInnValid ? '' : 'border-color: red; color: red;';

        const card = document.createElement('div');
        card.className = 'company-card';
        card.style = "background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 15px; margin-bottom: 15px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.05);";
        
        // Создаем элементы через innerHTML, но само ЗНАЧЕНИЕ (value) названия будем ставить отдельно через свойство .value
        card.innerHTML = `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px;">
                <input type="text" class="comp-name-input" placeholder="Название компании">
                <input type="text" placeholder="ИНН" style="${innBorder}" value="${comp.inn}" oninput="window.updateDet(${comp.id},'inn',this.value,false)">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <select onchange="window.updateDet(${comp.id},'region',this.value)">${getRegionOptions(comp.region)}</select>
                <div class="toggle-group">
                    <button class="toggle-btn ${comp.ownership == 'ul' ? 'selected' : ''}" onclick="window.updateDet(${comp.id},'ownership','ul')">ЮЛ</button>
                    <button class="toggle-btn ${comp.ownership == 'ip' ? 'selected' : ''}" onclick="window.updateDet(${comp.id},'ownership','ip')">ИП</button>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><div style="font-size: 10px; color: #999; margin-bottom: 4px; font-weight: 700;">ЛИЧНЫЙ КАБИНЕТ</div>
                    <div class="toggle-group">
                        <button class="toggle-btn ${comp.lk=='base'?'selected':''}" onclick="window.toggleOption(${comp.id},'lk','base')">Базовый</button>
                        <button class="toggle-btn ${comp.lk=='prof'?'selected':''}" onclick="window.toggleOption(${comp.id},'lk','prof')">Проф</button>
                    </div>
                </div>
                <div><div style="font-size: 10px; color: #999; margin-bottom: 4px; font-weight: 700;">МНОГОПОЛЬЗ. РЕЖИМ</div>
                    <div class="toggle-group">
                        <button class="toggle-btn ${comp.multiUser=='small'?'selected':''}" onclick="window.toggleOption(${comp.id},'multiUser','small')">2-9</button>
                        <button class="toggle-btn ${comp.multiUser=='large'?'selected':''}" onclick="window.toggleOption(${comp.id},'multiUser','large')">10+</button>
                    </div>
                </div>
            </div>
            ${idx > 0 ? `<button onclick="window.removeDet(${comp.id})" style="position:absolute; top: -10px; right: -10px; background: #fff; border: 1px solid #eee; border-radius: 50%; width: 24px; height: 24px; color: red; cursor: pointer;">&times;</button>` : ''}
        `;

        // Безопасная установка названия, которая не боится кавычек
        const nameInput = card.querySelector('.comp-name-input');
        nameInput.value = comp.name;
        nameInput.oninput = (e) => window.updateDet(comp.id, 'name', e.target.value, false);

        cardsContainer.appendChild(card);
    });
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
        finalImg.src = "image_f4c793.jpg";
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