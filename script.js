const STATE = {
  tariffs: [],
  isGroup: false,
  mode: 'fast', 
  discount: 0,
  existingCount: 0,
  solo: { region: '77', ownership: 'ul', duration: '1', employees: 1 },
  fastRows: [{ id: Date.now(), region: '77', ulCount: 1, ipCount: 0 }],
  detailedCompanies: [{ id: Date.now(), name: '', inn: '', region: '77', ownership: 'ul', lk: 'none', multiUser: 'none' }]
};

const RANGES = [
  { min: 1, max: 2, label: "1-2" }, { min: 3, max: 5, label: "3-5" }, { min: 6, max: 10, label: "6-10" },
  { min: 11, max: 15, label: "11-15" }, { min: 16, max: 25, label: "16-25" }, { min: 26, max: 50, label: "26-50" },
  { min: 51, max: 100, label: "51-100" }, { min: 101, max: 9999, label: "101+" }
];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('Цены для Калькулятора 1СО.json');
    const data = await res.json();
    let rawTariffs = data["Тарифы по регионам"].filter(t => t && t.Код && t.Регион);
    const priority = ['77', '50', '78'];
    STATE.tariffs = rawTariffs.sort((a, b) => {
      const aP = priority.indexOf(String(a.Код));
      const bP = priority.indexOf(String(b.Код));
      if (aP !== -1 && bP !== -1) return aP - bP;
      return aP !== -1 ? -1 : (bP !== -1 ? 1 : String(a.Код).localeCompare(String(b.Код), undefined, {numeric: true}));
    });
    init();
  } catch (e) { console.error("Ошибка загрузки:", e); }
});

function init() {
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
  render();
}

function render() {
  const container = document.getElementById('dynamic-fields');
  container.innerHTML = '';
  if (!STATE.isGroup) renderSoloFast(container);
  else {
    if (STATE.mode === 'addon') renderAddonMode(container);
    else if (STATE.mode === 'detailed') renderDetailedMode(container);
    else renderGroupFast(container);
  }
  calculate();
}

function renderSoloFast(container) {
  container.innerHTML = `
    <div class="form-row"><label>Регион</label><select id="s-reg">${STATE.tariffs.map(t => `<option value="${t.Код}">${t.Регион}</option>`).join('')}</select></div>
    <div class="grid-adaptive">
      <div><label>Тип</label><div class="toggle-group" id="s-own">
        <button class="toggle-btn ${STATE.solo.ownership==='ul'?'selected':''}" data-val="ul">ЮЛ</button>
        <button class="toggle-btn ${STATE.solo.ownership==='ip'?'selected':''}" data-val="ip">ИП</button>
      </div></div>
      <div><label>Срок</label><div class="toggle-group" id="s-dur">
        <button class="toggle-btn ${STATE.solo.duration==='1'?'selected':''}" data-val="1">1 год</button>
        <button class="toggle-btn ${STATE.solo.duration==='2'?'selected':''}" data-val="2">2 года</button>
      </div></div>
    </div>
    <div class="form-row" style="margin-top:15px;">
      <label>Сколько сотрудников будут подписывать отчетность своим сертификатом?</label>
      <input type="number" id="s-emp" value="${STATE.solo.employees}" min="1">
    </div>`;
  document.getElementById('s-reg').onchange = (e) => { STATE.solo.region = e.target.value; calculate(); };
  document.getElementById('s-emp').oninput = (e) => { STATE.solo.employees = parseInt(e.target.value)||1; calculate(); };
  document.querySelectorAll('#s-own .toggle-btn').forEach(b => b.onclick = () => { STATE.solo.ownership = b.dataset.val; render(); });
  document.querySelectorAll('#s-dur .toggle-btn').forEach(b => b.onclick = () => { STATE.solo.duration = b.dataset.val; render(); });
}

function renderGroupFast(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 5px; font-size: 12px; color: #666; padding: 0 5px;">
      <div>Регион</div><div>ЮЛ</div><div>ИП</div><div></div>
    </div>
    <div id="f-rows"></div>
    <button class="submit-btn" id="add-f-row" style="margin-top:10px;">+ Добавить регион</button>`;
  const list = document.getElementById('f-rows');
  STATE.fastRows.forEach(row => {
    const div = document.createElement('div');
    div.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";
    div.innerHTML = `
      <select onchange="window.updateFast(${row.id},'region',this.value)" style="width:100%">${STATE.tariffs.map(t=>(`<option value="${t.Код}" ${row.region==t.Код?'selected':''}>${t.Регион}</option>`)).join('')}</select>
      <input type="number" value="${row.ulCount}" oninput="window.updateFast(${row.id},'ulCount',this.value)" style="width:100%">
      <input type="number" value="${row.ipCount}" oninput="window.updateFast(${row.id},'ipCount',this.value)" style="width:100%">
      <button onclick="window.removeFast(${row.id})" style="color:red; background:none; border:none; font-size:20px; cursor:pointer;">×</button>`;
    list.appendChild(div);
  });
  document.getElementById('add-f-row').onclick = () => { STATE.fastRows.push({id:Date.now(), region:'77', ulCount:1, ipCount:0}); render(); };
}

function renderCards(list) {
  STATE.detailedCompanies.forEach((comp, idx) => {
    const card = document.createElement('div');
    card.className = 'company-card';
    const safeName = (comp.name || '').replace(/"/g, '&quot;');
    card.innerHTML = `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px;">
        <input type="text" placeholder="Название" value="${safeName}" oninput="window.updateDet(${comp.id},'name',this.value,false)">
        <input type="text" placeholder="ИНН" value="${comp.inn}" oninput="window.updateDet(${comp.id},'inn',this.value,false)">
      </div>
      <div class="grid-adaptive" style="margin-bottom: 15px;">
        <select onchange="window.updateDet(${comp.id},'region',this.value)">${STATE.tariffs.map(t => `<option value="${t.Код}" ${comp.region == t.Код ? 'selected' : ''}>${t.Регион}</option>`).join('')}</select>
        <div class="toggle-group">
          <button class="toggle-btn ${comp.ownership == 'ul' ? 'selected' : ''}" onclick="window.updateDet(${comp.id},'ownership','ul')">ЮЛ</button>
          <button class="toggle-btn ${comp.ownership == 'ip' ? 'selected' : ''}" onclick="window.updateDet(${comp.id},'ownership','ip')">ИП</button>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">Личный кабинет:</label>
        <div class="toggle-group" style="display: flex; width: 100%;">
          <button class="toggle-btn ${comp.lk=='base'?'selected':''}" style="flex:1" onclick="window.toggleLK(${comp.id},'base')">Базовый</button>
          <button class="toggle-btn ${comp.lk=='prof'?'selected':''}" style="flex:1" onclick="window.toggleLK(${comp.id},'prof')">Проф</button>
        </div>
      </div>
      <div>
        <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">Многопользовательский режим:</label>
        <div class="toggle-group" style="display: flex; width: 100%;">
          <button class="toggle-btn ${comp.multiUser=='small'?'selected':''}" style="flex:1" onclick="window.toggleMultiUser(${comp.id},'small')">2-9</button>
          <button class="toggle-btn ${comp.multiUser=='large'?'selected':''}" style="flex:1" onclick="window.toggleMultiUser(${comp.id},'large')">10+</button>
        </div>
      </div>
      ${idx > 0 ? `<button onclick="window.removeDet(${comp.id})" style="position:absolute; top:5px; right:5px; color:red; background:none; border:none; font-size:20px; cursor:pointer;">×</button>` : ''}
    `;
    list.appendChild(card);
  });
}

function calculate() {
  let total = 0, basePriceNoGK = 0, logs = [];
  const priceEl = document.getElementById('total-price'), detailsEl = document.getElementById('details-content');
  let discEl = document.getElementById('discount-info') || document.createElement('div');

  if (!STATE.isGroup) {
    discEl.style.display = 'none'; priceEl.classList.remove('price-warning');
    const t = STATE.tariffs.find(x => x.Код == STATE.solo.region);
    if (t) {
      let isTwo = STATE.solo.duration === '2';
      let base = (STATE.solo.ownership === 'ul') ? (isTwo ? t.Column5 : t.ЮЛ) : (isTwo ? t.Column14 : t.ИП);
      let val = parseInt(base) || 0;
      total += val;
      logs.push(`Лицензия 1С-Отчетности (${STATE.solo.ownership==='ul'?'ЮЛ':'ИП'}), ${t.Регион}, на ${isTwo?'2 года':'1 год'} | ${val} ₽`);
      if (STATE.solo.employees >= 2) {
        let add = parseInt(STATE.solo.employees >= 10 ? t.Column30 : t["Многопользовательский режим"]) || 0;
        total += add;
        logs.push(`Многопользовательский режим (${STATE.solo.employees >= 10 ? '10+' : '2-9'} пользователей) | ${add} ₽`);
      }
    }
  } else {
    const totalCount = (STATE.mode === 'addon' ? STATE.existingCount : 0) + (STATE.mode === 'fast' ? STATE.fastRows.reduce((a, b) => a + b.ulCount + b.ipCount, 0) : STATE.detailedCompanies.length);
    if (totalCount < 3) { priceEl.textContent = "Минимум 3 организации"; discEl.style.display = 'none'; detailsEl.innerText = "Нужно минимум 3 орг."; return; }
    priceEl.classList.remove('price-warning'); discEl.style.display = 'block';
    const rangeTag = RANGES.find(x => totalCount >= x.min && totalCount <= x.max)?.label || "1-2";

    if (STATE.mode === 'fast') {
      STATE.fastRows.forEach(r => {
        const t = STATE.tariffs.find(x => x.Код == r.region); if (!t) return;
        const keyU = (totalCount <= 5) ? 'Column6' : (totalCount <= 10) ? 'Column7' : (totalCount <= 15) ? 'Column8' : (totalCount <= 25) ? 'Column9' : (totalCount <= 50) ? 'Column10' : (totalCount <= 100) ? 'Column11' : 'Column12';
        const keyI = (totalCount <= 5) ? 'Column15' : (totalCount <= 10) ? 'Column16' : (totalCount <= 15) ? 'Column17' : (totalCount <= 25) ? 'Column18' : (totalCount <= 50) ? 'Column19' : (totalCount <= 100) ? 'Column20' : 'Column21';
        let prU = parseInt(t[keyU]) || 0, prI = parseInt(t[keyI]) || 0;
        if (r.ulCount > 0) { total += (prU * r.ulCount); logs.push(`Лицензия 1С-Отчетности (ЮЛ [ГК ${rangeTag}]), ${t.Регион}, на 1 год: ${r.ulCount} шт. | ${prU * r.ulCount} ₽`); }
        if (r.ipCount > 0) { total += (prI * r.ipCount); logs.push(`Лицензия 1С-Отчетности (ИП [ГК ${rangeTag}]), ${t.Регион}, на 1 год: ${r.ipCount} шт. | ${prI * r.ipCount} ₽`); }
        basePriceNoGK += (parseInt(t.ЮЛ)*r.ulCount + parseInt(t.ИП)*r.ipCount);
      });
    } else {
      STATE.detailedCompanies.forEach(c => {
        const t = STATE.tariffs.find(x => x.Код == c.region); if (!t) return;
        const key = (c.ownership === 'ul') ? 
          ((totalCount <= 5) ? 'Column6' : (totalCount <= 10) ? 'Column7' : (totalCount <= 15) ? 'Column8' : (totalCount <= 25) ? 'Column9' : (totalCount <= 50) ? 'Column10' : (totalCount <= 100) ? 'Column11' : 'Column12') :
          ((totalCount <= 5) ? 'Column15' : (totalCount <= 10) ? 'Column16' : (totalCount <= 15) ? 'Column17' : (totalCount <= 25) ? 'Column18' : (totalCount <= 50) ? 'Column19' : (totalCount <= 100) ? 'Column20' : 'Column21');
        let pGK = parseInt(t[key]) || 0;
        total += pGK; basePriceNoGK += parseInt(c.ownership === 'ul' ? t.ЮЛ : t.ИП) || 0;
        let innPart = (c.inn && (STATE.mode === 'detailed' || STATE.mode === 'addon')) ? `, ИНН ${c.inn}` : '';
        logs.push(`Лицензия 1С-Отчетности для компании ${c.name || 'Орг'}${innPart}, ${t.Регион}, на 1 год | ${pGK} ₽`);
        if (c.lk !== 'none') { let lkP = parseInt(c.lk === 'base' ? t.Column32 : t.Column34) || 0; total += lkP; basePriceNoGK += lkP; logs.push(`ЛК (${c.lk==='base'?'Баз':'Проф'}) для ${c.name || 'Орг'} | ${lkP} ₽`); }
        if (c.multiUser !== 'none') { let muP = parseInt(c.multiUser === 'small' ? t["Многопользовательский режим"] : t.Column30) || 0; total += muP; basePriceNoGK += muP; logs.push(`Многопользовательский режим (${c.multiUser==='small'?'2-9':'10+'}) для ${c.name || 'Орг'} | ${muP} ₽`); }
      });
    }
    const savePct = Math.round(((basePriceNoGK - total) / basePriceNoGK) * 100);
    discEl.innerHTML = `Ваша скидка составила: ${savePct}% ⓘ`;
  }
  priceEl.textContent = `${Math.round(total).toLocaleString()} ₽`; detailsEl.innerText = logs.join('\n');
}

document.getElementById('generate-pdf').onclick = function() {
    // 1. Сбрасываем прокрутку сайта в ноль (ВАЖНО для html2canvas)
    window.scrollTo(0, 0);

    const wrapper = document.getElementById('pdf-container-wrapper');
    const template = document.getElementById('pdf-template');
    const summary = document.getElementById('summary-block');
    const page2 = document.getElementById('page-2');
    
    // Данные
    document.getElementById('pdf-total').innerText = document.getElementById('total-price').innerText;
    const discInfo = document.getElementById('discount-info');
    document.getElementById('pdf-discount').innerText = (discInfo && discInfo.offsetParent !== null) ? discInfo.innerText.replace('ⓘ', '') : '';
    summary.style.display = 'block';

    const lines = document.getElementById('details-content').innerText
        .split('\n')
        .filter(l => l.trim() !== '')
        .map(line => line.replace(/\[ГК\s*[^\]]+\]/g, '').trim());

    const rowsP1 = document.getElementById('pdf-rows');
    const rowsP2 = document.getElementById('pdf-rows-p2');
    rowsP1.innerHTML = '';
    rowsP2.innerHTML = '';

    // Распределение страниц
    if (lines.length >= 10) {
        page2.style.display = 'block';
        document.getElementById('res-place-p2').appendChild(summary);
    } else {
        page2.style.display = 'none';
        document.getElementById('res-place-p1').appendChild(summary);
    }

    // Заполнение строк (шрифт 10)
    lines.forEach(line => {
        const tr = document.createElement('tr');
        if (line.includes('|')) {
            const [text, price] = line.split('|');
            tr.innerHTML = `
                <td style="padding: 4px 0; border-bottom: 1px solid #ffdbdb; font-size: 10pt;">${text.trim()}</td>
                <td style="padding: 4px 0; border-bottom: 1px solid #ffdbdb; text-align: right; font-weight: bold; font-size: 10pt; color: #FF5D5B;">${price.trim()}</td>`;
        } else {
            tr.innerHTML = `<td colspan="2" style="padding: 4px 0; border-bottom: 1px solid #ffdbdb; font-size: 9pt; color: #666;">${line}</td>`;
        }
        (lines.length >= 10 ? rowsP2 : rowsP1).appendChild(tr);
    });

    // Настройки PDF
    const opt = {
        margin: 0,
        filename: 'КП_1С_Отчетность.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    // Показываем контейнер для захвата
    wrapper.style.cssText = "position: absolute; left: -9999px; top: 0; display: block; width: 794px;";

    html2pdf().set(opt).from(template).save().then(() => {
        wrapper.style.display = 'none';
        // Убираем summary обратно
        document.body.appendChild(summary);
        summary.style.display = 'none';
    });
};

function renderDetailedMode(container) { container.innerHTML = `<div id="det-cards"></div><button class="submit-btn" id="add-c-btn">+ Добавить компанию</button>`; renderCards(document.getElementById('det-cards')); document.getElementById('add-c-btn').onclick = () => { STATE.detailedCompanies.push({ id: Date.now(), name: '', inn: '', region: '77', ownership: 'ul', lk: 'none', multiUser: 'none' }); render(); }; }
function renderAddonMode(container) { container.innerHTML = `<div class="form-row"><label>Уже в ГК</label><input type="number" id="add-exist" value="${STATE.existingCount}"></div><div id="det-cards"></div><button class="submit-btn" id="add-c-btn">+ Добавить компанию</button>`; renderCards(document.getElementById('det-cards')); document.getElementById('add-exist').oninput = (e) => { STATE.existingCount = parseInt(e.target.value)||0; calculate(); }; document.getElementById('add-c-btn').onclick = () => { STATE.detailedCompanies.push({ id: Date.now(), name: '', inn: '', region: '77', ownership: 'ul', lk: 'none', multiUser: 'none' }); render(); }; }

window.updateFast = (id, f, v) => { const r = STATE.fastRows.find(x=>x.id==id); if(r) r[f] = f.includes('Count') ? (parseInt(v)||0) : v; calculate(); };
window.removeFast = (id) => { if(STATE.fastRows.length > 1) { STATE.fastRows = STATE.fastRows.filter(x=>x.id!=id); render(); } };
window.updateDet = (id, f, v, redraw = true) => { const c = STATE.detailedCompanies.find(x=>x.id==id); if(c) c[f] = v; if(redraw) render(); else calculate(); };
window.removeDet = (id) => { STATE.detailedCompanies = STATE.detailedCompanies.filter(x=>x.id!=id); render(); };
window.toggleLK = (id, t) => { const c = STATE.detailedCompanies.find(x=>x.id==id); if(c) c.lk = (c.lk === t) ? 'none' : t; render(); };
window.toggleMultiUser = (id, t) => { const c = STATE.detailedCompanies.find(x=>x.id==id); if(c) c.multiUser = (c.multiUser === t) ? 'none' : t; render(); };