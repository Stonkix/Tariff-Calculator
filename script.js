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

const formatPrice = (v) => Math.round(v).toLocaleString('ru-RU') + ' ₽';

const getRegionOptions = (selected) => 
  STATE.tariffs.map(t => `<option value="${t.Код}" ${selected == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('');

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

    try {
        const res = await fetch('Цены для Калькулятора 1СО.json');
        const data = await res.json();
        STATE.tariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
        setupEventListeners();
        render();
    } catch (e) { console.error("Ошибка загрузки данных:", e); }
});

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
    container.innerHTML = `<div id="f-rows"></div><button class="submit-btn" style="background:#FF5D5B; margin-top:10px;" onclick="addFastRow()">+ Добавить регион</button>`;
    STATE.fastRows.forEach(row => {
        const div = document.createElement('div');
        div.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";
        div.innerHTML = `
            <select onchange="window.updateFast(${row.id},'region',this.value)">${getRegionOptions(row.region)}</select>
            <input type="number" value="${row.ulCount}" oninput="window.updateFast(${row.id},'ulCount',this.value)" placeholder="ЮЛ">
            <input type="number" value="${row.ipCount}" oninput="window.updateFast(${row.id},'ipCount',this.value)" placeholder="ИП">
            <button onclick="window.removeFast(${row.id})" style="color:#ccc; background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>`;
        document.getElementById('f-rows').appendChild(div);
    });
}

function renderDetailedMode(container, showExisting) {
    let html = showExisting ? `<div class="form-row" style="margin-bottom:20px;"><label>Уже подключено в ГК</label><input type="number" value="${STATE.existingCount}" oninput="STATE.existingCount=parseInt(this.value)||0; calculate()"></div>` : '';
    html += `<div id="det-cards"></div><button class="submit-btn" style="background:#FF5D5B;" onclick="addDetailedCompany()">+ Добавить компанию</button>`;
    container.innerHTML = html;
    STATE.detailedCompanies.forEach((comp) => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.style = "background:#fff; border:1px solid #eee; border-radius:12px; padding:15px; margin-bottom:15px; position:relative;";
        card.innerHTML = `
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
                <input type="text" placeholder="Название" value="${comp.name}" oninput="window.updateDet(${comp.id},'name',this.value,false)">
                <input type="text" placeholder="ИНН" value="${comp.inn}" oninput="window.updateDet(${comp.id},'inn',this.value,false)">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <select onchange="window.updateDet(${comp.id},'region',this.value)">${getRegionOptions(comp.region)}</select>
                <div class="toggle-group">
                    <button class="toggle-btn ${comp.ownership=='ul'?'selected':''}" onclick="window.updateDet(${comp.id},'ownership','ul')">ЮЛ</button>
                    <button class="toggle-btn ${comp.ownership=='ip'?'selected':''}" onclick="window.updateDet(${comp.id},'ownership','ip')">ИП</button>
                </div>
            </div>`;
        document.getElementById('det-cards').appendChild(card);
    });
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
            const p = (STATE.solo.ownership === 'ul') ? (isTwo ? t.Column4 : t.ЮЛ) : (isTwo ? t.Column13 : t.ИП);
            total += parseInt(p) || 0;
            logs.push(`Лицензия ${STATE.solo.ownership.toUpperCase()}, ${t.Регион}, ${isTwo?'2 года':'1 год'} | ${formatPrice(p)}`);
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
                if (r.ulCount > 0) { 
                    const sum = pUL * r.ulCount; total += sum; baseTotal += (parseInt(t.ЮЛ)*r.ulCount);
                    logs.push(`ЮЛ (${t.Регион}) | ${formatPrice(pUL)} x ${r.ulCount} | ${formatPrice(sum)}`); 
                }
                if (r.ipCount > 0) { 
                    const sum = pIP * r.ipCount; total += sum; baseTotal += (parseInt(t.ИП)*r.ipCount);
                    logs.push(`ИП (${t.Регион}) | ${formatPrice(pIP)} x ${r.ipCount} | ${formatPrice(sum)}`); 
                }
            });
        } else {
            STATE.detailedCompanies.forEach(c => {
                const t = STATE.tariffs.find(x => x.Код == c.region); if (!t) return;
                const pGK = parseInt(t[c.ownership === 'ul' ? col.ul : col.ip]) || 0;
                total += pGK; baseTotal += parseInt(c.ownership === 'ul' ? t.ЮЛ : t.ИП) || 0;
                logs.push(`${c.name || 'Орг'} (${t.Регион}) | ${formatPrice(pGK)}`);
            });
        }
        const pct = Math.round(((baseTotal - total) / baseTotal) * 100);
        ui.discount.innerHTML = `Ваша скидка составила: ${pct}% ⓘ`;
    }
    ui.price.textContent = formatPrice(total); ui.details.innerText = logs.join('\n');
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

        // Сохраняем копии страниц, чтобы вернуть их в HTML после генерации
        const page2Copy = page2.cloneNode(true);
        const pageLastCopy = pageLast.cloneNode(true);

        // 1. Полная очистка динамики
        document.querySelectorAll('.pdf-dynamic-el').forEach(el => el.remove());
        
        // 2. Подготовка блоков
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

        // 3. Распределение строк
        const lines = document.getElementById('details-content').innerText.split('\n').filter(l => l.trim());
        const rows1 = document.getElementById('pdf-rows');
        const rows2 = page2.querySelector('#pdf-rows-p2'); // Ищем внутри текущей страницы
        
        rows1.innerHTML = ''; 
        if (rows2) rows2.innerHTML = '';

        lines.forEach((line, idx) => {
            const tr = document.createElement('tr');
            if (line.includes('|')) {
                const parts = line.split('|');
                const t = parts.length > 2 ? parts[0] + ' | ' + parts[1] : parts[0];
                const p = parts[parts.length - 1];
                tr.innerHTML = `<td style="padding:5px 0; border-bottom:1px solid #eee; font-size:10pt;">${t.trim()}</td>
                                <td style="padding:5px 0; border-bottom:1px solid #eee; text-align:right; font-weight:700; color:#FF5D5B; font-size:10pt;">${p.trim()}</td>`;
            } else {
                tr.innerHTML = `<td colspan="2" style="padding:5px 0; font-size:9pt; color:#666;">${line}</td>`;
            }
            if (idx < 10) rows1.appendChild(tr); else if (rows2) rows2.appendChild(tr);
        });

        const placeP1 = document.getElementById('res-place-p1');
        const placeP2 = page2.querySelector('#res-place-p2');
        placeP1.innerHTML = '';
        if (placeP2) placeP2.innerHTML = '';
        pageLast.innerHTML = '';

        // 4. УПРАВЛЕНИЕ СТРУКТУРОЙ ШАБЛОНА (Физическое удаление)
        if (lines.length > 5) {
            // Режим 6+ строк (Две страницы)
            pageLast.remove(); // Удаляем 3-ю страницу совсем
            page2.style.display = 'block';
            
            if (lines.length >= 10 && placeP2) placeP2.appendChild(summary); else placeP1.appendChild(summary);
            
            if (placeP2) {
                placeP2.appendChild(contact1);
                placeP2.appendChild(finalImg);
                placeP2.appendChild(contact2);
            }
        } else {
            // Режим 1-5 строк (Одна страница)
            page2.remove(); // Удаляем 2-ю страницу
            pageLast.remove(); // Удаляем 3-ю страницу
            
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
            // 5. ВОССТАНОВЛЕНИЕ: возвращаем удаленные страницы в DOM для следующего раза
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
window.addFastRow = () => { STATE.fastRows.push({id:Date.now(), region:'77', ulCount:1, ipCount:0}); render(); };
window.updateFast = (id, f, v) => { const r = STATE.fastRows.find(x=>x.id==id); if(r) r[f] = f.includes('Count') ? (parseInt(v)||0) : v; calculate(); };
window.removeFast = (id) => { if(STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x=>x.id!=id); render(); } };
window.addDetailedCompany = () => { STATE.detailedCompanies.push({id:Date.now(), name:'', inn:'', region:'77', ownership:'ul', lk:'none', multiUser:'none'}); render(); };
window.updateDet = (id, f, v, redraw = true) => { const c = STATE.detailedCompanies.find(x=>x.id==id); if(c) c[f] = v; if(redraw) render(); else calculate(); };
window.removeDet = (id) => { if(STATE.detailedCompanies.length > 1) { STATE.detailedCompanies = STATE.detailedCompanies.filter(x=>x.id!=id); render(); } };
window.toggleOption = (id, field, value) => { 
    const c = STATE.detailedCompanies.find(x=>x.id==id); if(!c) return;
    c[field] = c[field] === value ? 'none' : value;
    render(); 
};