const CONSTANTS = {
  UL_KEYS: ["Column7", "Column8", "Column9", "Column10", "Column11", "Column12", "Column13"],
  IP_KEYS: ["Column17", "Column18", "Column19", "Column20", "Column21", "Column22", "Column23"],
  GROUP_DEFAULT_ROWS: 1
}

const STATE = {
  tariffs: [],
  companies: []
}

const Utils = {
  safeParseInt: val => parseInt(val || 0) || 0,
  formatCurrency: num => Number(num).toLocaleString('ru-RU'),
  createElement: (tag, className = '', props = {}) => {
    const el = document.createElement(tag)
    if (className) el.className = className
    Object.assign(el, props)
    return el
  }
}

async function getTariffs() {
  try {
    const res = await fetch('tariffs.json')
    const json = await res.json()
    return (json["Тарифы по регионам"] || []).filter(e => e?.["Регион"] && e?.["Код"])
  } catch {
    alert("Ошибка загрузки тарифов")
    return []
  }
}

function fillRegionSelect(select, regions) {
  select.innerHTML = '<option value="">Выберите регион</option>'
  regions.sort((a, b) => a["Регион"].localeCompare(b["Регион"]))
  regions.forEach(r => {
    const opt = Utils.createElement("option", "", { value: r["Код"], textContent: r["Регион"] })
    select.appendChild(opt)
  })
}

// --- новая версия карточки компании ---
function createCompanyCard(company, regions) {
  const card = Utils.createElement("div", "company-card")
  const header = Utils.createElement("div", "company-header")

  // поля ввода прямо на форме
  const nameInput = Utils.createElement("input", "company-input", {
    type: "text",
    placeholder: "Название компании",
    value: company.name || ""
  })
  const innInput = Utils.createElement("input", "company-input", {
    type: "text",
    placeholder: "ИНН",
    value: company.inn || ""
  })

  nameInput.addEventListener("input", e => company.name = e.target.value)
  innInput.addEventListener("input", e => company.inn = e.target.value)

  const removeBtn = Utils.createElement("button", "remove-row-btn", { innerHTML: "×" })
  removeBtn.onclick = () => {
    STATE.companies = STATE.companies.filter(c => c.id !== company.id)
    card.remove()
    recalcAllCompanies()
  }

  header.append(nameInput, innInput, removeBtn)
  card.appendChild(header)

  // блок регионов
  const regionBlock = Utils.createElement("div", "company-region-block")
  const regionHeader = Utils.createElement("div", "region-header", {
    innerHTML: "<div>Регион</div><div>ИП</div><div>ЮЛ</div>"
  })
  const rowsContainer = Utils.createElement("div", "region-rows")
  regionBlock.append(regionHeader, rowsContainer)

  const addRegionBtn = Utils.createElement("button", "btn-secondary small", {
    textContent: "Добавить регион"
  })
  addRegionBtn.onclick = () => createRegionRow(company, rowsContainer, regions)

  const totalLine = Utils.createElement("div", "total", {
    id: `companyTotal-${company.id}`,
    textContent: "Итог: 0 ₽"
  })

  card.append(regionBlock, addRegionBtn, totalLine)
  document.getElementById("companyContainer").appendChild(card)

  createRegionRow(company, rowsContainer, regions)
}

function createRegionRow(company, container, regions) {
  const row = Utils.createElement("div", "group-row")
  const select = Utils.createElement("select")
  fillRegionSelect(select, regions)
  const ipInput = Utils.createElement("input", "", { type: "number", placeholder: "ИП", min: 0, value: 0 })
  const ulInput = Utils.createElement("input", "", { type: "number", placeholder: "ЮЛ", min: 0, value: 0 })
  const removeBtn = Utils.createElement("button", "remove-row-btn", { innerHTML: "×" })

  removeBtn.onclick = () => {
    row.remove()
    recalcCompany(company.id)
  }

  ;[select, ipInput, ulInput].forEach(el => {
    el.addEventListener("input", () => recalcCompany(company.id))
    el.addEventListener("change", () => recalcCompany(company.id))
    row.appendChild(el)
  })
  row.appendChild(removeBtn)
  container.appendChild(row)
}

function recalcCompany(companyId) {
  const company = STATE.companies.find(c => c.id === companyId)
  if (!company) return

  const card = document.getElementById(`companyTotal-${companyId}`).closest(".company-card")
  const rows = card.querySelectorAll(".group-row")

  let total = 0
  let totalCompanies = 0
  const parsed = []

  rows.forEach(row => {
    const regionCode = Utils.safeParseInt(row.querySelector("select").value)
    const ip = Utils.safeParseInt(row.querySelectorAll("input")[0].value)
    const ul = Utils.safeParseInt(row.querySelectorAll("input")[1].value)
    const region = STATE.tariffs.find(r => r["Код"] === regionCode)
    if (region) {
      parsed.push({ region, ip, ul })
      totalCompanies += ip + ul
    }
  })

  const index = getTariffIndex(totalCompanies)
  parsed.forEach(({ region, ip, ul }) => {
    total += ip * Number(region[CONSTANTS.IP_KEYS[index]]) + ul * Number(region[CONSTANTS.UL_KEYS[index]])
  })

  company.total = total
  document.getElementById(`companyTotal-${companyId}`).textContent = `Итог: ${Utils.formatCurrency(total)} ₽`
  recalcAllCompanies()
}

function recalcAllCompanies() {
  const total = STATE.companies.reduce((acc, c) => acc + (c.total || 0), 0)
  document.getElementById("groupResults").textContent = `Общий итог: ${Utils.formatCurrency(total)} ₽`
}

function getTariffIndex(count) {
  if (count >= 101) return 6
  if (count >= 51) return 5
  if (count >= 26) return 4
  if (count >= 16) return 3
  if (count >= 11) return 2
  if (count >= 6) return 1
  return 0
}

// ---- одиночный расчёт ----
function recalcNonGroup() {
  const regionCode = Utils.safeParseInt(document.getElementById("region-select").value)
  const region = STATE.tariffs.find(r => r["Код"] === regionCode)
  if (!region) {
    document.getElementById("nonGroupTotal").textContent = "Итог: 0 ₽"
    return
  }

  const isUL = document.getElementById("ownership-ul-btn").classList.contains("selected")
  const is2Year = document.getElementById("duration2-btn").classList.contains("selected")
  const employees = Utils.safeParseInt(document.getElementById("employeeCount").value)

  let base = isUL
    ? (is2Year ? region["Column5"] : region["ЮЛ"])
    : (is2Year ? region["Column15"] : region["ИП"])

  let addon = 0
  if (employees >= 2 && employees <= 9) addon = Number(region["Многопользовательский режим"])
  if (employees >= 10) addon = Number(region["Column32"])

  const total = Number(base) + addon
  document.getElementById("nonGroupTotal").textContent = `Итог: ${Utils.formatCurrency(total)} ₽`
}

// ---- инициализация ----
function setupListeners() {
  const bindClick = (id, fn) => document.getElementById(id)?.addEventListener("click", fn)
  const bindInput = (id, fn) => document.getElementById(id)?.addEventListener("input", fn)

  bindClick("ownership-ip-btn", () => toggleSelection("ownership-ip-btn", "ownership-ul-btn", recalcNonGroup))
  bindClick("ownership-ul-btn", () => toggleSelection("ownership-ul-btn", "ownership-ip-btn", recalcNonGroup))
  bindClick("duration1-btn", () => toggleSelection("duration1-btn", "duration2-btn", recalcNonGroup))
  bindClick("duration2-btn", () => toggleSelection("duration2-btn", "duration1-btn", recalcNonGroup))
  bindInput("region-select", recalcNonGroup)
  bindInput("employeeCount", recalcNonGroup)

  bindClick("group-no-btn", () => toggleScreen("non-group"))
  bindClick("group-yes-btn", () => toggleScreen("group"))

  document.getElementById("addCompanyBtn").addEventListener("click", () => {
    const company = { id: Date.now(), name: "", inn: "", rows: [], total: 0 }
    STATE.companies.push(company)
    createCompanyCard(company, STATE.tariffs)
  })
}

function toggleSelection(onId, offId, callback) {
  document.getElementById(onId).classList.add("selected")
  document.getElementById(offId).classList.remove("selected")
  callback?.()
}

function toggleScreen(mode) {
  const isGroup = mode === "group"
  document.getElementById("screen-group").classList.toggle("active", isGroup)
  document.getElementById("screen-non-group").classList.toggle("active", !isGroup)
  toggleSelection(isGroup ? "group-yes-btn" : "group-no-btn", isGroup ? "group-no-btn" : "group-yes-btn")
}

async function bootstrap() {
  STATE.tariffs = await getTariffs()
  if (!STATE.tariffs.length) return
  fillRegionSelect(document.getElementById("region-select"), STATE.tariffs)
  setupListeners()
  recalcNonGroup()
}

bootstrap()

