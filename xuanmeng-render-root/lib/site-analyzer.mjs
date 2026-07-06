const PRODUCT_HINTS = [
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
  ["machine", "industrial machinery"],
  ["tool", "industrial tools"],
  ["mold", "mold products"],
  ["plastic", "plastic products"],
];

const PAGE_PATTERNS = {
  about: /about|company|profile|factory|who-we-are|our-story/i,
  product: /product|products|category|solution|solutions|oem|odm/i,
  contact: /contact|inquiry|quote|rfq|get-in-touch/i,
  content: /blog|news|article|guide|faq|knowledge|resource/i,
};

export async function analyzeWebsite(input) {
  const startUrl = normalizeUrl(input.url || input.website || input.sourceLinks?.[0]);
  if (!startUrl) {
    throw new Error("请提供官网链接");
  }

  const homepage = await fetchPage(startUrl);
  const discovered = discoverImportantLinks(startUrl, homepage.html);
  const pages = [homepage];
  for (const url of discovered.slice(0, 7)) {
    try {
      pages.push(await fetchPage(url));
    } catch {
      // Keep going; one broken product/contact page should not block diagnosis.
    }
  }

  const audit = buildAudit(startUrl, pages);
  const patch = buildPatch(startUrl, audit, input);
  return { patch, audit };
}

export function normalizeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;
  return "";
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; XuanmengDiagnosisAgent/1.0; +https://xuanmeng-agent.local)",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`抓取失败：${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("目标页面不是 HTML");
    }
    const html = await response.text();
    return extractPage(response.url || url, html);
  } finally {
    clearTimeout(timeout);
  }
}

function extractPage(url, html) {
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = decodeHtml(cleanHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return {
    url,
    html,
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
      || pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, 5),
    h2: [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, 10),
    links: extractLinks(url, html),
    text: text.slice(0, 25000),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasCanonical: /rel=["']canonical["']/i.test(html),
    hasStructuredData: /application\/ld\+json/i.test(html),
  };
}

function extractLinks(baseUrl, html) {
  const links = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const href = new URL(match[1], baseUrl).href;
      links.push(href.split("#")[0]);
    } catch {
      // Ignore malformed links.
    }
  }
  return [...new Set(links)];
}

function discoverImportantLinks(startUrl, html) {
  const origin = new URL(startUrl).origin;
  const links = extractLinks(startUrl, html)
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin === origin && !/\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4|mp3)$/i.test(parsed.pathname);
      } catch {
        return false;
      }
    });

  const ranked = links
    .map((url) => ({ url, score: linkScore(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
  return [...new Set(ranked)];
}

function linkScore(url) {
  let score = 0;
  Object.values(PAGE_PATTERNS).forEach((pattern) => {
    if (pattern.test(url)) score += 10;
  });
  if (/\/products?\//i.test(url)) score += 6;
  if (/\/(about|contact|products?|blog|faq)/i.test(url)) score += 4;
  return score;
}

function buildAudit(startUrl, pages) {
  const combinedText = pages.map((page) => `${page.title} ${page.description} ${page.h1.join(" ")} ${page.h2.join(" ")} ${page.text}`).join(" ").toLowerCase();
  const links = pages.flatMap((page) => page.links);
  const pageUrls = pages.map((page) => page.url);
  const homepage = pages[0];
  const counts = {
    pages: pages.length,
    productPages: pageUrls.filter((url) => PAGE_PATTERNS.product.test(url)).length,
    aboutPages: pageUrls.filter((url) => PAGE_PATTERNS.about.test(url)).length,
    contactPages: pageUrls.filter((url) => PAGE_PATTERNS.contact.test(url)).length,
    contentPages: pageUrls.filter((url) => PAGE_PATTERNS.content.test(url)).length,
    words: pages.reduce((sum, page) => sum + page.wordCount, 0),
  };

  const signals = {
    https: startUrl.startsWith("https://"),
    title: Boolean(homepage.title),
    description: Boolean(homepage.description),
    h1: homepage.h1.length > 0,
    viewport: pages.some((page) => page.hasViewport),
    canonical: pages.some((page) => page.hasCanonical),
    structuredData: pages.some((page) => page.hasStructuredData),
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(combinedText),
    whatsapp: /whatsapp|wa\.me|skype/i.test(combinedText + links.join(" ").toLowerCase()),
    inquiry: /inquiry|quote|rfq|get a quote|contact us|send message|request/i.test(combinedText),
    factory: /factory|manufacturer|workshop|production line|quality control|iso|certificate|certification/i.test(combinedText),
    cases: /case|project|client|customer|testimonial|partner/i.test(combinedText),
    faq: /faq|frequently asked|question|answer|how to|why choose/i.test(combinedText),
    blog: /blog|news|article|guide|knowledge|resource/i.test(combinedText + pageUrls.join(" ").toLowerCase()),
    seoKeywords: /manufacturer|supplier|factory|custom|oem|odm|wholesale/i.test(combinedText),
  };

  const product = inferProduct(`${startUrl} ${combinedText}`);
  const markets = inferMarkets(combinedText);
  const company = inferCompany(new URL(startUrl).hostname, pages);
  const scores = {
    trustAssets: clamp(2 + boolCount([signals.factory, signals.cases, signals.email, signals.whatsapp]) + counts.aboutPages, 1, 10),
    productPages: clamp(2 + counts.productPages * 2 + (signals.seoKeywords ? 1 : 0), 1, 10),
    contentDepth: clamp(1 + counts.contentPages * 2 + (signals.blog ? 2 : 0) + (counts.words > 4000 ? 2 : counts.words > 1800 ? 1 : 0), 1, 10),
    seoTech: clamp(2 + boolCount([signals.https, signals.title, signals.description, signals.h1, signals.viewport, signals.canonical, signals.structuredData]), 1, 10),
    ctaQuality: clamp(2 + boolCount([signals.inquiry, signals.email, signals.whatsapp]) * 2 + counts.contactPages, 1, 10),
    geoReadiness: clamp(1 + boolCount([signals.faq, signals.structuredData, signals.seoKeywords, signals.factory]) + counts.contentPages, 1, 10),
  };

  return {
    startUrl,
    company,
    product,
    markets,
    pages: pages.map(({ url, title, description, h1, wordCount }) => ({ url, title, description, h1, wordCount })),
    counts,
    signals,
    scores,
    summary: buildSummary(scores, counts, signals),
  };
}

function buildPatch(startUrl, audit, input) {
  return {
    company: input.company || audit.company,
    website: startUrl,
    product: input.product || audit.product,
    markets: input.markets || audit.markets,
    companyType: audit.signals.factory ? "factory" : "trader",
    dealSize: inferDealSize(`${audit.product} ${audit.summary}`),
    monthlySpend: Number(input.monthlySpend || 60000),
    monthlyLeads: Number(input.monthlyLeads || 25),
    conversionRate: Number(input.conversionRate || 4),
    platformDependence: Number(input.platformDependence || 68),
    trustAssets: audit.scores.trustAssets,
    productPages: audit.scores.productPages,
    contentDepth: audit.scores.contentDepth,
    seoTech: audit.scores.seoTech,
    ctaQuality: audit.scores.ctaQuality,
    geoReadiness: audit.scores.geoReadiness,
    channels: audit.signals.blog || audit.signals.seoKeywords ? ["alibaba", "exhibition", "seo"] : ["alibaba", "exhibition"],
    pain: buildPain(audit),
  };
}

function buildSummary(scores, counts, signals) {
  const weak = [];
  if (scores.productPages <= 4) weak.push("产品页承接不足");
  if (scores.contentDepth <= 4) weak.push("内容资产较薄");
  if (scores.geoReadiness <= 4) weak.push("GEO/AI 搜索引用条件不足");
  if (scores.ctaQuality <= 4) weak.push("询盘入口不够明显");
  if (scores.trustAssets <= 4) weak.push("工厂与信任证据不足");
  const good = [];
  if (signals.https) good.push("HTTPS");
  if (signals.description) good.push("Meta 描述");
  if (signals.factory) good.push("工厂/资质信息");
  if (signals.inquiry) good.push("询盘入口");
  return `已抓取 ${counts.pages} 个页面，识别 ${counts.productPages} 个产品/方案相关页面、${counts.contentPages} 个内容页。优势：${good.join("、") || "基础信息可访问"}。短板：${weak.join("、") || "可进入增长优化阶段"}。`;
}

function buildPain(audit) {
  return `${audit.summary} 建议围绕 ${audit.product} 建立独立站获客闭环，优先补齐 SEO 内容、GEO 问答结构和询盘转化入口。`;
}

function inferCompany(domain, pages) {
  const text = `${pages[0]?.title || ""} ${pages[0]?.description || ""}`;
  const match = text.match(/([A-Z][A-Za-z0-9&\-\s]{2,60}(?:Co\.|Company|Ltd\.|Limited|Factory|Manufacturer|Group))/);
  if (match) return match[1].trim();
  const root = domain.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ");
  return root.replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferProduct(text) {
  const lower = text.toLowerCase();
  const hit = PRODUCT_HINTS.find(([key]) => lower.includes(key));
  if (hit) return hit[1];
  const productPath = lower.match(/products?\/([a-z0-9-]+)/)?.[1]?.replace(/-/g, " ");
  return productPath || "B2B export products";
}

function inferMarkets(text) {
  const lower = text.toLowerCase();
  const markets = [];
  [["美国", "usa"], ["德国", "germany"], ["英国", "uk"], ["澳大利亚", "australia"], ["中东", "middle east"], ["欧洲", "europe"], ["加拿大", "canada"], ["东南亚", "southeast asia"]].forEach(([cn, key]) => {
    if (lower.includes(key)) markets.push(cn);
  });
  return markets.length ? markets.join("、") : "美国、欧洲、澳大利亚";
}

function inferDealSize(text) {
  const lower = text.toLowerCase();
  if (/machine|equipment|project|custom|industrial|system/.test(lower)) return "large";
  if (/wholesale|consumer|accessor/.test(lower)) return "small";
  return "mid";
}

function pick(html, pattern) {
  const match = html.match(pattern);
  return match ? strip(match[1]) : "";
}

function strip(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function boolCount(values) {
  return values.filter(Boolean).length;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}
