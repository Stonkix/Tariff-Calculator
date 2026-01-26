/**
 * КОНФИГУРАЦИЯ И СОСТОЯНИЕ
 */
const STATE = {
  tariffs: [],
  isGroup: false,
  mode: 'fast', 
  existingCount: 0,
  solo: { region: '77', ownership: 'ul', duration: '1', employees: 1 },
  fastRows: [{ id: Date.now(), region: '77', ulCount: 1, ipCount: 0 }],
  detailedCompanies: [{ id: Date.now(), name: '', inn: '', region: '77', ownership: 'ul', lk: 'none', multiUser: 'none' }]
};

// Хелпер для создания HTML выпадающего списка регионов
const getRegionOptions = (selected) => 
  STATE.tariffs.map(t => `<option value="${t.Код}" ${selected == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('');

/**
 * ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Загрузка контактов партнера
    const fields = ['partner-phone', 'partner-email'];
    fields.forEach(id => {
        const saved = localStorage.getItem(`p-${id}`);
        if (saved) document.getElementById(id).value = saved;
        document.getElementById(id).oninput = (e) => localStorage.setItem(`p-${id}`, e.target.value);
    });

    try {
        const res = await fetch('Цены для Калькулятора 1СО.json');
        const data = await res.json();
        STATE.tariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
        setupEventListeners();
        render();
    } catch (e) { console.error("Ошибка загрузки данных:", e); }
});

function setupEventListeners() {
    // Переключатель Одиночный/Групповой
    document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#group-main-toggle .toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.isGroup = e.target.dataset.value === 'yes';
            document.getElementById('mode-selection-container').style.display = STATE.isGroup ? 'block' : 'none';
            render();
        };
    });
    // Переключатель режимов ГК
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
 * РЕНДЕРИНГ ИНТЕРФЕЙСА
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
            <label>Сколько сотрудников будет подписывать отчетность своим сертификатом?</label>
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
            <input type="number" value="${STATE.existingCount}" style="width: 100px; text-align: center;" oninput="STATE.existingCount=parseInt(this.value)||0; calculate()">
        </div>` : '';
    html += `<div id="det-cards"></div><button class="submit-btn" style="background: #FF5D5B;" onclick="addDetailedCompany()">+ Добавить компанию</button>`;
    container.innerHTML = html;

    STATE.detailedCompanies.forEach((comp, idx) => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.style = "background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 15px; margin-bottom: 15px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.05);";
        card.innerHTML = `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px;">
                <input type="text" placeholder="Название компании" value="${comp.name}" oninput="window.updateDet(${comp.id},'name',this.value,false)">
                <input type="text" placeholder="ИНН" value="${comp.inn}" oninput="window.updateDet(${comp.id},'inn',this.value,false)">
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
                        <button class="toggle-btn ${comp.lk=='base'?'selected':''}" onclick="window.toggleOption(${comp.id},'lk','base')">Баз.</button>
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
        document.getElementById('det-cards').appendChild(card);
    });
}

/**
 * ГЕНЕРАЦИЯ PDF
 */
document.getElementById('generate-pdf').onclick = function() {
    try {
        window.scrollTo(0, 0);
        const wrapper = document.getElementById('pdf-container-wrapper');
        const template = document.getElementById('pdf-template');
        const page2 = document.getElementById('page-2');
        const pageLast = document.getElementById('page-last');

        // Очистка динамических элементов
        document.querySelectorAll('.pdf-dynamic-el').forEach(el => el.remove());
        const p2Header = page2.querySelector('h2');
        if (p2Header) p2Header.style.display = 'none';

        // Подготовка блоков цены и контактов
        const summary = createPdfBlock('summary-block');
        summary.querySelector('.pdf-total-val').innerText = document.getElementById('total-price').innerText;
        const disc = document.getElementById('discount-info');
        if (disc?.offsetParent) summary.querySelector('.pdf-discount-val').innerText = disc.innerText.replace('ⓘ', '');

        const contact1 = createPdfBlock('contact-box-template');
        contact1.style.display = 'flex';
        const contact2 = contact1.cloneNode(true);
        [contact1, contact2].forEach(b => {
            b.querySelector('.c-phone').innerText = document.getElementById('partner-phone').value;
            b.querySelector('.c-email').innerText = document.getElementById('partner-email').value;
        });

        const finalImg = document.createElement('img');
        finalImg.src = "image_f4c793.jpg";
        finalImg.style = "width:100%; display:block; margin-top: 15px;";
        finalImg.classList.add('pdf-dynamic-el');

        // Распределение строк по таблицам
        const lines = document.getElementById('details-content').innerText.split('\n').filter(l => l.trim());
        const rows1 = document.getElementById('pdf-rows'), rows2 = document.getElementById('pdf-rows-p2');
        rows1.innerHTML = ''; rows2.innerHTML = '';

        lines.forEach((line, idx) => {
            const tr = document.createElement('tr');
            if (line.includes('|')) {
                const [t, p] = line.split('|');
                tr.innerHTML = `<td style="padding:5px 0; border-bottom:1px solid #eee; font-size:10pt;">${t.trim()}</td>
                                <td style="padding:5px 0; border-bottom:1px solid #eee; text-align:right; font-weight:700; color:#FF5D5B; font-size:10pt;">${p.trim()}</td>`;
            } else {
                tr.innerHTML = `<td colspan="2" style="padding:5px 0; font-size:9pt; color:#666;">${line}</td>`;
            }
            if (idx < 10) rows1.appendChild(tr); else rows2.appendChild(tr);
        });

        // Логика расстановки страниц
        const needsP2 = lines.length > 5;
        const hasRowsOnP2 = lines.length >= 10;
        const placeP1 = document.getElementById('res-place-p1');
        const placeP2 = document.getElementById('res-place-p2');
        pageLast.innerHTML = '';

        if (needsP2) {
            page2.style.display = 'block';
            pageLast.style.display = 'none';
            (hasRowsOnP2 ? placeP2 : placeP1).appendChild(summary);
            placeP2.appendChild(contact1);
            placeP2.appendChild(finalImg);
            placeP2.appendChild(contact2);
        } else {
            page2.style.display = 'none';
            pageLast.style.display = 'block';
            placeP1.appendChild(summary);
            placeP1.appendChild(contact1);
            pageLast.appendChild(finalImg);
            pageLast.appendChild(contact2);
        }

        wrapper.style.display = 'block';
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';

        html2pdf().set({
            margin: 0, filename: 'КП_1С_Отчетность.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        }).from(template).save().then(() => wrapper.style.display = 'none');

    } catch (e) { console.error("Ошибка PDF:", e); }
};

function createPdfBlock(id) {
    const el = document.getElementById(id).cloneNode(true);
    el.classList.add('pdf-dynamic-el');
    return el;
}

/**
 * ЛОГИКА РАСЧЕТОВ
 */
function calculate() {
    let total = 0, baseTotal = 0, logs = [];
    const ui = { price: document.getElementById('total-price'), details: document.getElementById('details-content'), discount: document.getElementById('discount-info') };

    if (!STATE.isGroup) {
        ui.discount.style.display = 'none';
        const t = STATE.tariffs.find(x => x.Код == STATE.solo.region);
        if (t) {
            const isTwo = STATE.solo.duration === '2';
            const price = (STATE.solo.ownership === 'ul') ? (isTwo ? t.Column5 : t.ЮЛ) : (isTwo ? t.Column14 : t.ИП);
            total += parseInt(price) || 0;
            logs.push(`Лицензия ${STATE.solo.ownership.toUpperCase()}, ${t.Регион}, ${isTwo?'2 года':'1 год'} | ${price} ₽`);
            if (STATE.solo.employees >= 2) {
                const add = parseInt(STATE.solo.employees >= 10 ? t.Column30 : t["Многопользовательский режим"]) || 0;
                total += add; logs.push(`Многопользовательский режим | ${add} ₽`);
            }
        }
    } else {
        const totalCount = (STATE.mode === 'addon' ? STATE.existingCount : 0) + 
                           (STATE.mode === 'fast' ? STATE.fastRows.reduce((a, b) => a + (parseInt(b.ulCount)||0) + (parseInt(b.ipCount)||0), 0) : STATE.detailedCompanies.length);
        
        if (totalCount < 3) {
            ui.price.textContent = "Мин. 3 орг."; ui.discount.style.display = 'none';
            ui.details.innerText = "Групповой тариф действует от 3-х организаций."; return;
        }

        ui.discount.style.display = 'block';
        const columnKey = getGroupColumnKey(totalCount);

        if (STATE.mode === 'fast') {
            STATE.fastRows.forEach(r => {
                const t = STATE.tariffs.find(x => x.Код == r.region); if (!t) return;
                const pUL = parseInt(t[columnKey.ul]) || 0, pIP = parseInt(t[columnKey.ip]) || 0;
                if (r.ulCount > 0) { total += pUL * r.ulCount; logs.push(`ЮЛ (${t.Регион}) x${r.ulCount} | ${pUL * r.ulCount} ₽`); }
                if (r.ipCount > 0) { total += pIP * r.ipCount; logs.push(`ИП (${t.Регион}) x${r.ipCount} | ${pIP * r.ipCount} ₽`); }
                baseTotal += (parseInt(t.ЮЛ)*r.ulCount + parseInt(t.ИП)*r.ipCount);
            });
        } else {
            STATE.detailedCompanies.forEach(c => {
                const t = STATE.tariffs.find(x => x.Код == c.region); if (!t) return;
                const pGK = parseInt(t[c.ownership === 'ul' ? columnKey.ul : columnKey.ip]) || 0;
                total += pGK; baseTotal += parseInt(c.ownership === 'ul' ? t.ЮЛ : t.ИП) || 0;
                logs.push(`${c.name || 'Орг'} ${c.inn ? '('+c.inn+')' : ''} | ${pGK} ₽`);
                if (c.lk !== 'none') {
                    const p = parseInt(c.lk === 'base' ? t.Column32 : t.Column34) || 0;
                    total += p; baseTotal += p; logs.push(`ЛК ${c.lk.toUpperCase()} | ${p} ₽`);
                }
                if (c.multiUser !== 'none') {
                    const p = parseInt(c.multiUser === 'small' ? t["Многопользовательский режим"] : t.Column30) || 0;
                    total += p; baseTotal += p; logs.push(`Многопольз. режим | ${p} ₽`);
                }
            });
        }
        const pct = Math.round(((baseTotal - total) / baseTotal) * 100);
        ui.discount.innerHTML = `Ваша скидка составила: ${pct}% ⓘ`;
    }
    ui.price.textContent = `${Math.round(total).toLocaleString()} ₽`; ui.details.innerText = logs.join('\n');
}

function getGroupColumnKey(count) {
    if (count <= 5) return { ul: 'Column6', ip: 'Column15' };
    if (count <= 10) return { ul: 'Column7', ip: 'Column16' };
    if (count <= 15) return { ul: 'Column8', ip: 'Column17' };
    if (count <= 25) return { ul: 'Column9', ip: 'Column18' };
    if (count <= 50) return { ul: 'Column10', ip: 'Column19' };
    if (count <= 100) return { ul: 'Column11', ip: 'Column20' };
    return { ul: 'Column12', ip: 'Column21' };
}

/**
 * ГЛОБАЛЬНЫЕ ФУНКЦИИ ОБНОВЛЕНИЯ
 */
window.updateSolo = (f, v) => { STATE.solo[f] = f === 'employees' ? parseInt(v)||1 : v; calculate(); };
window.addFastRow = () => { STATE.fastRows.push({id:Date.now(), region:'77', ulCount:1, ipCount:0}); render(); };
window.updateFast = (id, f, v) => { const r = STATE.fastRows.find(x=>x.id==id); if(r) r[f] = f.includes('Count') ? (parseInt(v)||0) : v; calculate(); };
window.removeFast = (id) => { if(STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x=>x.id!=id); render(); } };
window.addDetailedCompany = () => { STATE.detailedCompanies.push({id:Date.now(), name:'', inn:'', region:'77', ownership:'ul', lk:'none', multiUser:'none'}); render(); };
window.updateDet = (id, f, v, redraw = true) => { const c = STATE.detailedCompanies.find(x=>x.id==id); if(c) c[f] = v; if(redraw) render(); else calculate(); };
window.removeDet = (id) => { if(STATE.detailedCompanies.length > 1) { STATE.detailedCompanies = STATE.detailedCompanies.filter(x=>x.id!=id); render(); } };
window.toggleOption = (id, field, value) => { 
    const c = STATE.detailedCompanies.find(x=>x.id==id); 
    if(!c) return;
    c[field] = c[field] === value ? 'none' : value;
    if (field === 'lk' && c.lk !== 'none') c.multiUser = 'none';
    if (field === 'multiUser' && c.multiUser !== 'none') c.lk = 'none';
    render(); 
};