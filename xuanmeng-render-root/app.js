const STORAGE_KEY = "xuanmeng_diagnosis_cases_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const form = $("#diagnosisForm");
const toast = $("#toast");

const channelProfiles = {
  alibaba: { name: "阿里国际站", cost: "高", quality: "中", control: "低", note: "适合起量，但比价强、平台规则变动大" },
  madeinchina: { name: "中国制造", cost: "中高", quality: "中", control: "低", note: "B2B 采购明显，但同质竞争仍强" },
  exhibition: { name: "展会", cost: "高", quality: "高", control: "中", note: "客户质量高，但频次低、获客成本高" },
  googleads: { name: "Google 广告", cost: "高", quality: "中高", control: "中", note: "见效快，但停投即停量" },
  seo: { name: "Google SEO", cost: "中", quality: "高", control: "高", note: "长期资产，适合沉淀高意向搜索流量" },
  social: { name: "LinkedIn/Facebook", cost: "中", quality: "中", control: "中", note: "适合触达决策人，但需要内容和私信节奏" },
  referral: { name: "老客户转介绍", cost: "低", quality: "高", control: "中", note: "质量高，但不可规模化" },
  offline: { name: "海外地推/分公司", cost: "高", quality: "高", control: "中", note: "适合重点市场深耕，管理成本高" }
};

const sampleCase = {
  company: "宁波恒拓五金制品有限公司",
  website: "https://www.hengtuo-hardware.com",
  product: "不锈钢水槽、商用厨卫五金、定制金属件",
  markets: "美国、德国、澳大利亚、中东",
  companyType: "factory",
  dealSize: "mid",
  channels: ["alibaba", "madeinchina", "exhibition", "googleads"],
  monthlySpend: 120000,
  monthlyLeads: 42,
  conversionRate: 4,
  platformDependence: 82,
  trustAssets: 5,
  productPages: 4,
  contentDepth: 2,
  seoTech: 3,
  ctaQuality: 4,
  geoReadiness: 1,
  pain: "平台投入越来越高，询盘很多都是比价客户；展会成本高但频次低。官网已经上线三年，但自然流量很少，英文产品页比较薄，也没有围绕 AI 搜索和 Google SEO 做内容。"
};

let currentData = getFormData();
let currentDiagnosis = null;
let currentAudit = null;

function init() {
  bindNavigation();
  bindForm();
  bindActions();
  updateRangeOutputs();
  renderArchive();
  renderEmptyReports();
  if (window.lucide) window.lucide.createIcons();
}

function bindNavigation() {
  document.addEventListener("click", (event) => {
    const navButton = event.target.closest(".nav-item");
    if (navButton) {
      event.preventDefault();
      showPanel(navButton.dataset.panel, true);
    }

    const reportButton = event.target.closest(".report-tab");
    if (reportButton) {
      event.preventDefault();
      showReport(reportButton.dataset.report);
    }
  });
}

function bindForm() {
  form.addEventListener("input", () => {
    updateRangeOutputs();
    currentData = getFormData();
  });
}

function bindActions() {
  $("#sampleBtn").addEventListener("click", () => {
    setFormData(sampleCase);
    showToast("已填入示例客户");
  });

  $("#clearBtn").addEventListener("click", () => {
    form.reset();
    updateRangeOutputs();
    currentDiagnosis = null;
    currentAudit = null;
    currentData = getFormData();
    resetOutputs();
    showToast("已清空录入信息");
  });

  $("#smartAnalyzeBtn").addEventListener("click", smartAnalyze);

  $("#toggleAdvancedBtn").addEventListener("click", () => {
    const details = $("#advancedFields");
    details.open = !details.open;
    $("#toggleAdvancedBtn span").textContent = details.open ? "收起高级补充" : "展开高级补充";
  });

  $("#runBtn").addEventListener("click", () => {
    currentData = getFormData();
    currentDiagnosis = diagnose(currentData);
    renderDiagnosis(currentData, currentDiagnosis);
    renderReports(currentData, currentDiagnosis);
    showPanel("diagnosisPanel");
    showToast("诊断已生成");
  });

  $("#saveBtn").addEventListener("click", () => {
    if (!currentDiagnosis) {
      currentData = getFormData();
      currentDiagnosis = diagnose(currentData);
      renderDiagnosis(currentData, currentDiagnosis);
      renderReports(currentData, currentDiagnosis);
    }
    saveCase(currentData, currentDiagnosis);
    showToast("客户档案已保存");
  });

  $("#copyReportBtn").addEventListener("click", async () => {
    const text = buildPlainReport(currentData, currentDiagnosis);
    await navigator.clipboard?.writeText(text);
    showToast("报告文字已复制");
  });

  $("#printBtn").addEventListener("click", () => window.print());
  $("#jsonBtn").addEventListener("click", exportCase);
  $("#importFile").addEventListener("change", importCase);
}

function showPanel(panelId, userTriggered = false) {
  const target = $(`#${panelId}`);
  if (!target) return;
  const current = $(".panel.active");
  if (userTriggered && current?.id === panelId) {
    showToast("当前已在这个页面");
  }
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === panelId));
  $$(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === panelId));
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showReport(reportId) {
  const target = $(`#${reportId}`);
  if (!target) return;
  $$(".report-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.report === reportId));
  $$(".report-view").forEach((view) => view.classList.toggle("active", view.id === reportId));
}

function getFormData() {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  data.channels = fd.getAll("channels");
  ["monthlySpend", "monthlyLeads", "conversionRate", "platformDependence", "trustAssets", "productPages", "contentDepth", "seoTech", "ctaQuality", "geoReadiness"].forEach((key) => {
    data[key] = Number(data[key] || 0);
  });
  return data;
}

async function smartAnalyze() {
  const fd = new FormData(form);
  const linksText = String(fd.get("sourceLinks") || "").trim();
  const siteText = String(fd.get("siteText") || "").trim();
  const quickProduct = String(fd.get("quickProduct") || "").trim();
  const quickMarkets = String(fd.get("quickMarkets") || "").trim();
  const links = extractLinks(linksText);

  if (!links.length && !siteText && !quickProduct) {
    showToast("先粘贴官网链接或官网文字");
    return;
  }

  const serverResult = await analyzeWithServer({ links, siteText, quickProduct, quickMarkets });
  if (serverResult) {
    const patch = {
      ...getFormData(),
      ...serverResult.patch,
      product: quickProduct || serverResult.patch.product,
      markets: quickMarkets || serverResult.patch.markets,
    };
    setFormData(patch);
    currentAudit = serverResult.audit;
    currentData = getFormData();
    currentDiagnosis = diagnose(currentData);
    renderDiagnosis(currentData, currentDiagnosis);
    renderReports(currentData, currentDiagnosis);
    updateServerCaptureResult(serverResult.audit);
    showToast("已完成官网真实抓取");
    return;
  }

  const primaryUrl = links[0] || "";
  const domain = getDomain(primaryUrl);
  const inferredCompany = inferCompany(domain, siteText);
  const inferredProduct = quickProduct || inferProduct([...links, siteText].join(" "));
  const inferredMarkets = quickMarkets || inferMarkets(siteText);
  const signals = inferSiteSignals({ links, siteText, product: inferredProduct });

  const patch = {
    company: form.elements.company.value || inferredCompany,
    website: form.elements.website.value || primaryUrl,
    product: form.elements.product.value || inferredProduct,
    markets: form.elements.markets.value || inferredMarkets,
    companyType: inferCompanyType(siteText),
    dealSize: inferDealSize(siteText, inferredProduct),
    monthlySpend: Number(form.elements.monthlySpend.value || 60000),
    monthlyLeads: Number(form.elements.monthlyLeads.value || 25),
    conversionRate: Number(form.elements.conversionRate.value || 4),
    platformDependence: Number(form.elements.platformDependence.value || signals.platformDependence),
    trustAssets: signals.trustAssets,
    productPages: signals.productPages,
    contentDepth: signals.contentDepth,
    seoTech: signals.seoTech,
    ctaQuality: signals.ctaQuality,
    geoReadiness: signals.geoReadiness,
    pain: form.elements.pain.value || buildAutoPain(signals, inferredProduct),
    channels: inferChannels(siteText)
  };

  setFormData({ ...getFormData(), ...patch });
  currentAudit = null;
  updateCaptureResult({ domain, links, inferredProduct, inferredMarkets, signals });
  currentData = getFormData();
  currentDiagnosis = diagnose(currentData);
  renderDiagnosis(currentData, currentDiagnosis);
  renderReports(currentData, currentDiagnosis);
  showToast("已完成智能识别");
}

async function analyzeWithServer({ links, siteText, quickProduct, quickMarkets }) {
  if (!links.length) return null;
  try {
    $("#captureResult").innerHTML = `
      <span>正在抓取官网</span>
      <strong>后端正在读取首页、产品页、About、Contact、FAQ/Blog 等页面...</strong>
    `;
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: links[0],
        sourceLinks: links,
        siteText,
        product: quickProduct,
        markets: quickMarkets,
      }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function extractLinks(text) {
  return text.split(/\s+/).map((item) => item.trim()).filter(Boolean).map((item) => {
    if (/^https?:\/\//i.test(item)) return item;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(item)) return `https://${item}`;
    return "";
  }).filter(Boolean);
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferCompany(domain, text) {
  const titleMatch = text.match(/([A-Z][A-Za-z0-9&\-\s]{2,60}(?:Co\.|Company|Ltd\.|Limited|Factory|Manufacturer|Group))/);
  if (titleMatch) return titleMatch[1].trim();
  if (!domain) return "";
  const root = domain.split(".")[0].replace(/[-_]/g, " ");
  return root.replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferProduct(text) {
  const lower = text.toLowerCase();
  const productMap = [
    ["sink", "stainless steel sink"],
    ["hardware", "hardware products"],
    ["led", "LED lighting"],
    ["pet", "pet products"],
    ["furniture", "furniture"],
    ["packaging", "packaging products"],
    ["valve", "industrial valves"],
    ["pump", "industrial pumps"],
    ["solar", "solar products"],
    ["textile", "textile products"],
    ["garment", "garments"],
    ["ceramic", "ceramic products"],
    ["battery", "battery products"],
    ["machine", "industrial machinery"]
  ];
  const hit = productMap.find(([key]) => lower.includes(key));
  if (hit) return hit[1];
  const pathWords = lower.match(/[a-z]+(?:-[a-z]+){1,4}/g)?.[0]?.replace(/-/g, " ");
  return pathWords || "B2B export products";
}

function inferMarkets(text) {
  const lower = text.toLowerCase();
  const markets = [];
  [["美国", "usa"], ["德国", "germany"], ["英国", "uk"], ["澳大利亚", "australia"], ["中东", "middle east"], ["欧洲", "europe"], ["加拿大", "canada"], ["东南亚", "southeast asia"]].forEach(([cn, key]) => {
    if (lower.includes(key)) markets.push(cn);
  });
  return markets.length ? markets.join("、") : "美国、欧洲、澳大利亚";
}

function inferCompanyType(text) {
  const lower = text.toLowerCase();
  if (lower.includes("factory") || lower.includes("manufacturer") || lower.includes("workshop")) return "factory";
  if (lower.includes("brand")) return "brand";
  if (lower.includes("trading") || lower.includes("import") || lower.includes("export")) return "trader";
  return "factory";
}

function inferDealSize(text, product) {
  const lower = `${text} ${product}`.toLowerCase();
  if (lower.includes("machine") || lower.includes("equipment") || lower.includes("project") || lower.includes("custom")) return "large";
  if (lower.includes("wholesale") || lower.includes("consumer") || lower.includes("accessories")) return "small";
  return "mid";
}

function inferChannels(text) {
  const lower = text.toLowerCase();
  const channels = ["alibaba", "exhibition"];
  if (lower.includes("google")) channels.push("seo");
  if (lower.includes("linkedin") || lower.includes("facebook")) channels.push("social");
  return [...new Set(channels)];
}

function inferSiteSignals({ links, siteText, product }) {
  const lower = `${links.join(" ")} ${siteText}`.toLowerCase();
  const count = (words) => words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  const trust = count(["factory", "certificate", "iso", "workshop", "quality", "about", "team", "case"]);
  const productDepth = links.filter((link) => /product|solution|category|shop/i.test(link)).length + count(["specification", "oem", "odm", "custom", "material"]);
  const content = count(["blog", "news", "guide", "faq", "how to", "article", "knowledge"]);
  const seo = count(["/product", "/blog", "/faq", "manufacturer", "supplier", "factory"]);
  const cta = count(["contact", "inquiry", "quote", "whatsapp", "email", "rfq"]);
  const geo = count(["faq", "question", "answer", "how to", "why choose", "manufacturer", "supplier"]);
  return {
    trustAssets: clamp(3 + trust, 1, 9),
    productPages: clamp(3 + productDepth, 1, 9),
    contentDepth: clamp(2 + content, 1, 8),
    seoTech: clamp(3 + seo, 1, 8),
    ctaQuality: clamp(3 + cta, 1, 9),
    geoReadiness: clamp(1 + geo, 1, 8),
    platformDependence: lower.includes("alibaba") ? 75 : 65
  };
}

function buildAutoPain(signals, product) {
  const weak = [];
  if (signals.contentDepth <= 3) weak.push("英文内容和行业文章较薄");
  if (signals.geoReadiness <= 3) weak.push("AI 搜索/GEO 准备不足");
  if (signals.ctaQuality <= 4) weak.push("询盘入口和 CTA 需要优化");
  return `${product || "主营产品"} 官网已完成初步识别，${weak.length ? weak.join("、") : "具备一定基础"}，建议进一步补齐独立站获客闭环。`;
}

function updateCaptureResult({ domain, links, inferredProduct, inferredMarkets, signals }) {
  $("#captureResult").innerHTML = `
    <span>识别完成 · ${links.length || 0} 个链接</span>
    <strong>${domain || "未识别域名"}｜产品：${inferredProduct || "待补充"}｜市场：${inferredMarkets || "待补充"}｜官网基础 ${Math.round(average([signals.trustAssets, signals.productPages, signals.ctaQuality]) * 10)} 分</strong>
  `;
}

function updateServerCaptureResult(audit) {
  $("#captureResult").innerHTML = `
    <span>真实抓取完成 · ${audit.counts.pages} 个页面</span>
    <strong>${audit.startUrl}｜产品：${audit.product}｜页面：产品 ${audit.counts.productPages} / 内容 ${audit.counts.contentPages} / 联系 ${audit.counts.contactPages}｜${audit.summary}</strong>
  `;
}

function setFormData(data) {
  Object.entries(data).forEach(([key, value]) => {
    if (key === "channels") return;
    const field = form.elements[key];
    if (field) field.value = value;
  });
  $$('input[name="channels"]').forEach((input) => {
    input.checked = (data.channels || []).includes(input.value);
  });
  updateRangeOutputs();
  currentData = getFormData();
}

function updateRangeOutputs() {
  $$('input[type="range"]').forEach((input) => {
    const output = $(`[data-output="${input.name}"]`);
    if (output) output.textContent = input.value;
  });
}

function diagnose(data) {
  const websiteBase = average([data.trustAssets, data.productPages, data.ctaQuality]) * 10;
  const seoBase = average([data.contentDepth, data.seoTech, data.productPages]) * 10;
  const geoBase = average([data.geoReadiness, data.contentDepth, data.trustAssets]) * 10;
  const channelBase = clamp(100 - data.platformDependence + data.channels.length * 4, 0, 100);
  const leadCost = data.monthlyLeads ? data.monthlySpend / data.monthlyLeads : data.monthlySpend;
  const conversionBase = clamp(data.conversionRate * 12 + data.ctaQuality * 4 + (data.dealSize === "large" ? 6 : 0), 0, 100);
  const costPressure = leadCost > 2500 ? 18 : leadCost > 1200 ? 10 : 4;
  const total = Math.round(
    websiteBase * .22 +
    seoBase * .24 +
    geoBase * .17 +
    channelBase * .18 +
    conversionBase * .19 -
    costPressure
  );

  const scores = {
    total: clamp(total, 0, 100),
    website: Math.round(websiteBase),
    seo: Math.round(seoBase),
    geo: Math.round(geoBase),
    channel: Math.round(channelBase),
    conversion: Math.round(conversionBase),
    leadCost: Math.round(leadCost || 0)
  };

  const maturity = getMaturity(scores.total);
  const issues = buildIssues(data, scores);
  const keywords = buildKeywords(data);
  const roadmap = buildRoadmap(data, scores, issues);
  const contentPlan = buildContentPlan(data, keywords);
  const channelRows = buildChannelRows(data);
  const salesPlaybook = buildSalesPlaybook(data, issues);
  const bottleneck = issues[0]?.title || "独立站获客系统尚未形成闭环";

  return {
    id: `XM-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    scores,
    maturity,
    issues,
    keywords,
    roadmap,
    contentPlan,
    channelRows,
    salesPlaybook,
    bottleneck,
    solution: chooseSolution(data, scores, issues)
  };
}

function average(values) {
  return values.reduce((sum, item) => sum + Number(item || 0), 0) / values.length;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function getMaturity(score) {
  if (score >= 78) return { level: "增长型", desc: "基础较完整，可以进入内容规模化和线索精细化运营。" };
  if (score >= 58) return { level: "建设型", desc: "已经具备独立站承接能力，但 SEO/GEO 与转化链路仍需系统补齐。" };
  if (score >= 38) return { level: "补课型", desc: "当前主要依赖平台或展会，官网还没有形成稳定获客资产。" };
  return { level: "起步型", desc: "建议先完成官网信任体系、产品页、关键词结构和询盘承接基础。" };
}

function buildIssues(data, scores) {
  const issues = [];
  if (data.platformDependence >= 65) {
    issues.push({
      title: "平台依赖过高，客户容易进入比价场",
      detail: `平台依赖度约 ${data.platformDependence}%，获客主动权和客户资产沉淀不足，建议把独立站作为核心信任阵地。`,
      action: "搭建 Google SEO + GEO 内容矩阵，把产品词、场景词和工厂能力词沉淀到官网。"
    });
  }
  if (scores.seo < 55) {
    issues.push({
      title: "SEO 内容深度不足，精准搜索流量承接弱",
      detail: "产品页、行业文章、FAQ 和案例页不足时，Google 很难判断网站专业度，也难进入长尾关键词排名。",
      action: "优先建设产品页模板、应用场景页、供应商对比页和采购 FAQ。"
    });
  }
  if (scores.geo < 45) {
    issues.push({
      title: "GEO 准备度低，难被 AI 搜索答案引用",
      detail: "AI 搜索更偏好结构清晰、证据充分、问答完整、品牌可信的网站内容。",
      action: "增加 Buyer Questions、规格参数、资质证据、案例数据和结构化 FAQ。"
    });
  }
  if (scores.website < 58) {
    issues.push({
      title: "官网信任资产不足，影响高质量买家留资",
      detail: "海外买家会先看工厂实力、团队、交付、资质、案例与视频证据，官网表达薄弱会拉低询盘转化。",
      action: "补充工厂实拍、质检流程、证书、客户案例、交期能力和团队响应机制。"
    });
  }
  if (scores.conversion < 55) {
    issues.push({
      title: "询盘转化链路偏弱，流量没有被充分承接",
      detail: `当前询盘成交率约 ${data.conversionRate || 0}%，需要把表单、WhatsApp、邮件回复和报价前沟通标准化。`,
      action: "设置多入口 CTA，配套首封英文回复、报价前问题清单和跟进节奏。"
    });
  }
  if (scores.leadCost > 2000) {
    issues.push({
      title: "单条有效询盘成本偏高",
      detail: `按当前数据估算，有效询盘成本约 ${formatMoney(scores.leadCost)} 元/条，获客效率存在优化空间。`,
      action: "用自然排名和内容资产稀释广告/展会成本，同时筛选更高意向关键词。"
    });
  }
  if (!issues.length) {
    issues.push({
      title: "基础较好，下一步应做规模化增长",
      detail: "客户已具备一定独立站承接基础，建议进入关键词扩张、内容自动化和线索评分阶段。",
      action: "建立月度内容计划、排名追踪和询盘质量评分。"
    });
  }
  return issues.slice(0, 6);
}

function buildKeywords(data) {
  const product = data.product || "industrial products";
  const cleanProduct = product.split(/[，,、/]/).map((item) => item.trim()).filter(Boolean)[0] || product;
  return [
    `${cleanProduct} manufacturer China`,
    `${cleanProduct} supplier`,
    `${cleanProduct} factory`,
    `custom ${cleanProduct}`,
    `${cleanProduct} wholesale`,
    `${cleanProduct} OEM`,
    `${cleanProduct} for ${firstMarket(data.markets)}`,
    `how to choose ${cleanProduct} supplier`
  ];
}

function firstMarket(markets = "") {
  return markets.split(/[，,、/]/).map((item) => item.trim()).filter(Boolean)[0] || "global buyers";
}

function buildContentPlan(data, keywords) {
  const product = data.product || "核心产品";
  return [
    { type: "产品页", title: `${product} 核心产品页重构`, purpose: "承接 manufacturer / supplier / factory 等高意向词" },
    { type: "应用场景页", title: `${firstMarket(data.markets)} 市场应用解决方案`, purpose: "匹配不同国家买家的场景化采购需求" },
    { type: "FAQ", title: "采购商高频问题问答库", purpose: "同时服务 SEO 长尾词和 AI 搜索引用" },
    { type: "案例页", title: "工厂交付案例与质检流程", purpose: "补强信任证据，提高询盘转化" },
    { type: "对比页", title: `How to choose ${keywords[1]}`, purpose: "截获正在筛选供应商的买家" },
    { type: "文章", title: `${keywords[7]}`, purpose: "覆盖早期研究型采购流量" }
  ];
}

function buildRoadmap(data, scores, issues) {
  return [
    {
      stage: "0-30 天",
      theme: "诊断与基础补齐",
      actions: [
        "完成官网结构、产品页、表单、信任素材和关键词基线审计",
        "输出核心关键词池和页面优先级",
        `优先处理：${issues[0]?.title || "官网承接能力"}`
      ],
      deliverables: ["获客诊断报告", "关键词地图", "官网整改清单"]
    },
    {
      stage: "31-60 天",
      theme: "内容资产建设",
      actions: [
        "重构核心产品页和应用场景页",
        "发布 FAQ、采购指南、供应商对比、案例内容",
        "建立询盘回复模板和线索分级规则"
      ],
      deliverables: ["SEO 页面包", "GEO 问答库", "销售跟进模板"]
    },
    {
      stage: "61-90 天",
      theme: "排名追踪与转化优化",
      actions: [
        "追踪 Google 收录、关键词排名和询盘来源",
        "根据高意向页面优化 CTA、表单和 WhatsApp 入口",
        "形成月度报告和下一轮内容扩张计划"
      ],
      deliverables: ["月度运营报告", "询盘质量分析", "下一季度增长计划"]
    }
  ];
}

function buildChannelRows(data) {
  const selected = data.channels.length ? data.channels : ["alibaba", "exhibition"];
  return selected.map((key) => ({
    key,
    ...channelProfiles[key]
  }));
}

function buildSalesPlaybook(data, issues) {
  const company = data.company || "该客户";
  const product = data.product || "主营产品";
  return {
    opening: `${company} 现在不是没有渠道，而是平台、展会和官网之间没有形成可沉淀的获客闭环。我们建议先围绕 ${product} 做一次独立站获客诊断，把流量、信任和询盘转化拆开看。`,
    questions: [
      "目前最稳定的询盘来自哪里？平台、展会、Google 还是老客户？",
      "一个有效询盘大概花多少钱？成交周期多长？",
      "客户进入官网后，是否能看到工厂、资质、交付案例和清晰的询盘入口？",
      "有没有围绕目标国家和产品关键词持续发布英文内容？",
      "销售收到询盘后，是否有统一的英文回复和跟进节奏？"
    ],
    close: `第一阶段不建议直接承诺排名，而是先交付诊断报告、关键词地图和 90 天执行计划。这样客户能清楚看到问题、路径和每个月的交付物。`,
    objection: [
      { q: "客户说已经有阿里/中国制造了", a: "平台是流量入口，但不是企业自己的数字资产。独立站负责沉淀信任、承接高质量搜索客户，并降低长期对平台规则的依赖。" },
      { q: "客户说官网做过没效果", a: "官网没效果通常不是网站本身无效，而是没有做关键词结构、内容深度、转化入口和持续运营。" },
      { q: "客户担心 SEO 太慢", a: "所以前 90 天要同时做基础修复、长尾内容和询盘转化，先看到收录、排名和询盘质量的阶段性变化。" }
    ]
  };
}

function chooseSolution(data, scores, issues) {
  if (scores.website < 45) return "官网信任体系重构 + 关键词地图";
  if (scores.seo < 55) return "SEO 内容资产包 + 页面结构优化";
  if (scores.geo < 45) return "GEO 问答库 + AI 搜索引用内容";
  if (scores.conversion < 55) return "询盘转化链路优化";
  return "内容规模化增长 + 月度运营报告";
}

function renderDiagnosis(data, diagnosis) {
  const { scores } = diagnosis;
  $("#maturityText").textContent = diagnosis.maturity.level;
  $("#bottleneckText").textContent = diagnosis.bottleneck;
  $("#solutionText").textContent = diagnosis.solution;
  $("#agentState").textContent = "诊断已完成";
  $("#agentStateText").textContent = `${data.company || "客户"} 的综合健康度为 ${scores.total} 分，建议优先推进：${diagnosis.solution}。`;
  $("#diagnosisStamp").textContent = `${diagnosis.id} · ${formatDate(diagnosis.createdAt)}`;

  const degrees = scores.total * 3.6;
  const ring = $("#scoreRing");
  ring.style.background = `conic-gradient(${scoreColor(scores.total)} ${degrees}deg, #e7eef8 ${degrees}deg)`;
  ring.querySelector("strong").textContent = scores.total;
  $("#scoreSummary").textContent = diagnosis.maturity.desc;

  const scoreItems = [
    ["官网承接", scores.website],
    ["SEO 基础", scores.seo],
    ["GEO 准备", scores.geo],
    ["渠道自主", scores.channel],
    ["询盘转化", scores.conversion]
  ];
  $("#scoreList").innerHTML = scoreItems.map(([label, value]) => `
    <article class="score-item">
      <span>${label}</span>
      <strong>${value}</strong>
      <div class="score-bar"><i style="width:${value}%; background:${scoreGradient(value)}"></i></div>
    </article>
  `).join("");

  $("#issueList").innerHTML = diagnosis.issues.map((issue, index) => `
    <article class="issue">
      <b>${index + 1}</b>
      <div>
        <strong>${issue.title}</strong>
        <p>${issue.detail}</p>
        <p><span class="tag">${issue.action}</span></p>
      </div>
    </article>
  `).join("");

  $("#channelTable").innerHTML = `
    <table>
      <thead>
        <tr><th>渠道</th><th>成本</th><th>线索质量</th><th>自主权</th><th>判断</th></tr>
      </thead>
      <tbody>
        ${diagnosis.channelRows.map((row) => `
          <tr>
            <td><strong>${row.name}</strong></td>
            <td><span class="tag ${row.cost.includes("高") ? "warn" : "good"}">${row.cost}</span></td>
            <td>${row.quality}</td>
            <td>${row.control}</td>
            <td>${row.note}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function scoreColor(value) {
  if (value >= 75) return "#1b9d68";
  if (value >= 55) return "#236cff";
  if (value >= 38) return "#d8951b";
  return "#d94c4c";
}

function scoreGradient(value) {
  if (value >= 75) return "linear-gradient(90deg, #1b9d68, #56d7c6)";
  if (value >= 55) return "linear-gradient(90deg, #236cff, #15b8a6)";
  if (value >= 38) return "linear-gradient(90deg, #d8951b, #ffbd5b)";
  return "linear-gradient(90deg, #d94c4c, #ff8a8a)";
}

function renderReports(data, diagnosis) {
  const auditBlock = currentAudit ? `
    <h4>官网真实抓取摘要</h4>
    <p>${currentAudit.summary}</p>
    <table>
      <thead><tr><th>页面</th><th>标题</th><th>字数</th></tr></thead>
      <tbody>${currentAudit.pages.slice(0, 8).map((page) => `<tr><td>${page.url}</td><td>${page.title || page.h1?.[0] || "未识别标题"}</td><td>${page.wordCount}</td></tr>`).join("")}</tbody>
    </table>
  ` : "";
  $("#reportClientName").textContent = `${data.company || "客户"} 获客诊断方案`;
  $("#reportDate").textContent = `${diagnosis.id} · ${formatDate(diagnosis.createdAt)}`;

  $("#summaryReport").innerHTML = `
    <h3>一、诊断结论</h3>
    <p>${data.company || "该客户"} 当前的核心问题是：${diagnosis.bottleneck}。综合获客健康度为 <strong>${diagnosis.scores.total} 分</strong>，属于 <strong>${diagnosis.maturity.level}</strong>。</p>
    <div class="report-grid">
      <div class="report-metric"><span>综合健康度</span><strong>${diagnosis.scores.total}</strong></div>
      <div class="report-metric"><span>有效询盘成本</span><strong>${formatMoney(diagnosis.scores.leadCost)} 元</strong></div>
      <div class="report-metric"><span>建议切入</span><strong>${diagnosis.solution}</strong></div>
    </div>
    <h4>核心问题</h4>
    <ol>${diagnosis.issues.map((issue) => `<li><strong>${issue.title}</strong>：${issue.detail}</li>`).join("")}</ol>
    <h4>建议方案</h4>
    <p>宣盟建议以“独立站信任资产 + Google SEO + AI 搜索 GEO + 询盘转化标准化”为主线，先完成 90 天基础建设，再进入关键词扩张和月度运营。</p>
    ${auditBlock}
  `;

  $("#seoReport").innerHTML = `
    <h3>二、SEO + GEO 获客建设方案</h3>
    <p>目标不是单纯写文章，而是围绕采购商搜索路径，建立能被 Google 和 AI 搜索理解、引用、推荐的英文内容资产。</p>
    <h4>建议关键词方向</h4>
    <ul>${diagnosis.keywords.map((kw) => `<li>${kw}</li>`).join("")}</ul>
    <h4>内容交付清单</h4>
    <table>
      <thead><tr><th>类型</th><th>页面/内容</th><th>目的</th></tr></thead>
      <tbody>${diagnosis.contentPlan.map((item) => `<tr><td>${item.type}</td><td>${item.title}</td><td>${item.purpose}</td></tr>`).join("")}</tbody>
    </table>
    <h4>GEO 重点</h4>
    <ul>
      <li>为每个核心产品补充采购问答、规格参数、认证证据、交付案例和工厂能力说明。</li>
      <li>页面表达使用清晰标题、短段落、列表和 FAQ，让 AI 搜索更容易抽取答案。</li>
      <li>建立品牌与产品的权威关系，例如 manufacturer、factory、custom supplier、OEM capability 等语义。</li>
    </ul>
  `;

  $("#roadmapReport").innerHTML = `
    <h3>三、90 天落地路线图</h3>
    <div class="roadmap">
      ${diagnosis.roadmap.map((stage) => `
        <article class="roadmap-card">
          <b>${stage.stage}</b>
          <h4>${stage.theme}</h4>
          <ul>${stage.actions.map((action) => `<li>${action}</li>`).join("")}</ul>
          <h4>交付物</h4>
          <ul>${stage.deliverables.map((item) => `<li>${item}</li>`).join("")}</ul>
        </article>
      `).join("")}
    </div>
  `;

  $("#salesReport").innerHTML = `
    <h3>四、销售跟进建议</h3>
    <h4>开场定位</h4>
    <p>${diagnosis.salesPlaybook.opening}</p>
    <h4>销售需要追问的问题</h4>
    <ol>${diagnosis.salesPlaybook.questions.map((q) => `<li>${q}</li>`).join("")}</ol>
    <h4>异议处理</h4>
    <table>
      <thead><tr><th>客户异议</th><th>建议回应</th></tr></thead>
      <tbody>${diagnosis.salesPlaybook.objection.map((item) => `<tr><td>${item.q}</td><td>${item.a}</td></tr>`).join("")}</tbody>
    </table>
    <h4>成交推进</h4>
    <p>${diagnosis.salesPlaybook.close}</p>
  `;
}

function renderEmptyReports() {
  const empty = "<p>生成诊断后，这里会自动输出可交付的客户方案。</p>";
  $("#summaryReport").innerHTML = empty;
  $("#seoReport").innerHTML = empty;
  $("#roadmapReport").innerHTML = empty;
  $("#salesReport").innerHTML = empty;
}

function resetOutputs() {
  $("#maturityText").textContent = "待诊断";
  $("#bottleneckText").textContent = "资料未录入";
  $("#solutionText").textContent = "先做获客诊断";
  $("#agentState").textContent = "等待客户资料";
  $("#agentStateText").textContent = "录入客户行业、渠道、官网基础和询盘数据后，可生成完整获客诊断方案。";
  $("#diagnosisStamp").textContent = "尚未生成";
  $("#scoreRing").style.background = "conic-gradient(var(--blue) 0deg, #e7eef8 0deg)";
  $("#scoreRing strong").textContent = "--";
  $("#scoreSummary").textContent = "填写客户信息后点击生成诊断。";
  $("#scoreList").innerHTML = "";
  $("#issueList").innerHTML = "";
  $("#channelTable").innerHTML = "";
  $("#reportClientName").textContent = "客户获客诊断方案";
  $("#reportDate").textContent = "--";
  renderEmptyReports();
}

function saveCase(data, diagnosis) {
  const cases = readCases();
  const record = { id: diagnosis.id, data, diagnosis, audit: currentAudit, savedAt: new Date().toISOString() };
  const next = [record, ...cases.filter((item) => item.id !== record.id)].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  renderArchive();
}

function readCases() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function renderArchive() {
  const cases = readCases();
  if (!cases.length) {
    $("#archiveList").innerHTML = `<div class="archive-item"><div><strong>暂无客户档案</strong><span>点击保存后，本地会记录最近 20 个诊断。</span></div></div>`;
    return;
  }
  $("#archiveList").innerHTML = cases.map((item) => `
    <article class="archive-item">
      <div>
        <strong>${item.data.company || "未命名客户"}</strong>
        <span>${item.id} · ${formatDate(item.savedAt)} · ${item.data.product || "未填写产品"}</span>
      </div>
      <button type="button" class="ghost-button" data-load="${item.id}"><i data-lucide="folder-open"></i><span>打开</span></button>
      <button type="button" class="ghost-button" data-delete="${item.id}"><i data-lucide="trash-2"></i><span>删除</span></button>
    </article>
  `).join("");
  $$("[data-load]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const record = readCases().find((item) => item.id === btn.dataset.load);
      if (!record) return;
      setFormData(record.data);
      currentData = record.data;
      currentDiagnosis = record.diagnosis || diagnose(record.data);
      currentAudit = record.audit || null;
      renderDiagnosis(currentData, currentDiagnosis);
      renderReports(currentData, currentDiagnosis);
      showPanel("diagnosisPanel");
      showToast("客户档案已打开");
    });
  });
  $$("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = readCases().filter((item) => item.id !== btn.dataset.delete);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      renderArchive();
      showToast("档案已删除");
    });
  });
  if (window.lucide) window.lucide.createIcons();
}

function exportCase() {
  if (!currentDiagnosis) {
    currentData = getFormData();
    currentDiagnosis = diagnose(currentData);
    renderDiagnosis(currentData, currentDiagnosis);
    renderReports(currentData, currentDiagnosis);
  }
  const payload = { data: currentData, diagnosis: currentDiagnosis };
  payload.audit = currentAudit;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFileName(currentData.company || "宣盟获客诊断")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("档案已导出");
}

function importCase(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      const data = payload.data || payload;
      setFormData(data);
      currentData = getFormData();
      currentDiagnosis = payload.diagnosis || diagnose(currentData);
      currentAudit = payload.audit || null;
      renderDiagnosis(currentData, currentDiagnosis);
      renderReports(currentData, currentDiagnosis);
      showPanel("diagnosisPanel");
      showToast("档案已导入");
    } catch {
      showToast("导入失败：JSON 格式不正确");
    }
  };
  reader.readAsText(file, "UTF-8");
}

function buildPlainReport(data, diagnosis) {
  if (!diagnosis) {
    return "请先生成诊断。";
  }
  return [
    `宣盟获客诊断 Agent`,
    `客户：${data.company || "未命名客户"}`,
    `产品：${data.product || "未填写"}`,
    `目标市场：${data.markets || "未填写"}`,
    `综合健康度：${diagnosis.scores.total} 分（${diagnosis.maturity.level}）`,
    `核心瓶颈：${diagnosis.bottleneck}`,
    `建议切入：${diagnosis.solution}`,
    "",
    "核心问题：",
    ...diagnosis.issues.map((issue, index) => `${index + 1}. ${issue.title} - ${issue.action}`),
    "",
    "90 天路线图：",
    ...diagnosis.roadmap.map((stage) => `${stage.stage}：${stage.theme}。交付物：${stage.deliverables.join("、")}`),
    "",
    "关键词方向：",
    ...diagnosis.keywords.map((kw) => `- ${kw}`)
  ].join("\n");
}

function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

init();
