// Run: node scripts/generate-seo-pages.mjs  -> writes static pages into public/ and refreshes sitemap.xml
import { mkdirSync, writeFileSync } from "node:fs";
const SITE = "https://www.baruk.co.ke", WA = "https://wa.me/254107129273", TODAY = new Date().toISOString().slice(0, 10);
const ADDR = "HG 66A, Tabere Close, Kileleshwa, Nairobi, Kenya";
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const P = [
 { slug: "china-to-kenya-shipping", nav: "China to Kenya shipping", type: "Service",
  title: "China to Kenya Shipping | Door-to-Door Cargo | Baruk Logistics",
  desc: "Ship cargo from China to Nairobi door to door: sourcing, sea & air freight, customs clearance and delivery, with a full landed-cost quote in 48 hours.",
  h1: "Shipping from China to Kenya, door to door",
  lead: "Baruk handles the whole journey from a supplier in China to your address in Nairobi: finding and verifying the supplier, freight, customs clearance and last-mile delivery. You get one landed-cost number before you commit.",
  secs: [["What door-to-door means","We source or collect your goods in China, consolidate them, ship by sea or air, clear them through KRA and KEBS requirements, and deliver in Nairobi. You deal with one team, not four."],
   ["Sea or air?","Air freight takes about 5–10 days and suits urgent or high-value cargo. Sea freight (FCL, LCL or groupage) is the cheaper route for heavy or bulky goods. We recommend one after seeing your cargo, and many customers split orders between the two."],
   ["Pay in shillings","You pay by M-Pesa in KES. There are no USD wire transfers or forex headaches, and we only pay suppliers after verification."],
   ["How to start","Tell us the product, quantity and budget. Individual items have a minimum order of KES 10,000. A full landed-cost quote reaches you within 48 hours."]],
  faq: [["How long does shipping from China to Kenya take?","Door to door is typically 7–21 days depending on whether you choose air or sea and on cargo readiness. We confirm timing in your quote."],["What is a landed-cost quote?","One figure covering product cost, freight, customs duty and our fee, so what you approve is what you pay."],["Can you ship if I already have a supplier?","Yes. Send us the supplier details and we handle freight, clearance and delivery."]],
  rel: ["sea-freight-china-kenya","air-freight-china-kenya","customs-clearance-nairobi","china-sourcing-agent-kenya","guides/cost-of-importing-from-china-to-kenya"] },
 { slug: "sea-freight-china-kenya", nav: "Sea freight", type: "Service",
  title: "Sea Freight from China to Kenya | FCL, LCL & Groupage | Baruk",
  desc: "Sea freight from China to Kenya: FCL, LCL and groupage with customs clearance and Nairobi delivery. Pay only for the space you use. Get a quote in 48 hours.",
  h1: "Sea freight from China to Kenya: FCL, LCL and groupage",
  lead: "Sea freight is the most economical way to move heavy, bulky or large-volume cargo from China. Baruk offers full containers and shared space so smaller traders can ship too.",
  secs: [["FCL: a full container","You book the whole container. It suits large orders, and your goods are not mixed with anyone else's."],
   ["LCL and groupage: share a container","We consolidate small orders into shared containers, so you pay only for the space your cargo takes. This removes the biggest barrier for small and growing traders."],
   ["Port to doorstep","We arrange clearance at the port and delivery to your premises, with status updates through the shipment."],
   ["What affects the price","Cargo volume or weight, product type, supplier location and clearance requirements. Your quote shows every component up front."]],
  faq: [["What is the difference between LCL and FCL?","FCL means you rent a whole container. LCL means your goods share one with other shippers and you pay for the space used."],["Can I ship a small order by sea?","Yes, through LCL or groupage. Send us the cargo details for a quote."],["Do you handle clearance for sea cargo?","Yes. KRA, KEBS and IDF paperwork is part of the service."]],
  rel: ["china-to-kenya-shipping","air-freight-china-kenya","customs-clearance-nairobi","guides/cost-of-importing-from-china-to-kenya"] },
 { slug: "air-freight-china-kenya", nav: "Air freight", type: "Service",
  title: "Air Freight from China to Kenya | 5–10 Days | Baruk Logistics",
  desc: "Air freight from China to Nairobi in 5–10 days. Express and standard options, fast customs clearance and doorstep delivery. Quote within 48 hours.",
  h1: "Air freight from China to Kenya in 5–10 days",
  lead: "When stock is running out or a project is waiting, air freight gets cargo to Kenya in roughly 5–10 days. Baruk manages the shipment, clearance and delivery.",
  secs: [["Express and standard","Express is for urgent cargo. Standard air freight costs less and still beats sea by weeks."],
   ["Best for","Samples, electronics, spare parts, fashion lines and any high-value or time-sensitive goods."],
   ["Clearance and delivery","We prepare the customs documentation, clear the cargo at the airport and deliver anywhere in Nairobi."],
   ["Getting a price","Share the product, quantity and approximate size or weight. Your quote includes freight, duty and our fee."]],
  faq: [["How fast is air freight from China to Kenya?","Typically 5–10 days. We confirm timing for your cargo in the quote."],["Is air freight or sea freight cheaper?","Sea is usually cheaper for heavy or bulky cargo; air is faster. We advise based on your goods."],["Can you deliver outside Nairobi?","Our last-mile delivery covers Nairobi. Ask us about other destinations."]],
  rel: ["china-to-kenya-shipping","sea-freight-china-kenya","customs-clearance-nairobi"] },
 { slug: "customs-clearance-nairobi", nav: "Customs clearance", type: "Service",
  title: "Customs Clearance Agent Nairobi | KRA, KEBS & IDF | Baruk",
  desc: "Customs clearance in Kenya handled for you: KRA, KEBS and IDF documentation so your cargo does not sit at the port. Based in Kileleshwa, Nairobi.",
  h1: "Customs clearance in Nairobi: KRA, KEBS and IDF handled",
  lead: "Paperwork delays are the most common reason imported cargo gets stuck. Baruk prepares and files the documentation so your goods move through the port or airport smoothly.",
  secs: [["What we handle","Import Declaration Forms (IDF), KRA customs entry and duty payment, and KEBS requirements for regulated products."],
   ["No surprises","Duty and clearance costs are built into your landed-cost quote before you approve, so there are no unexpected port charges."],
   ["Which goods need extra steps","Some products need standards verification or special permits. Tell us what you are importing and we confirm the requirements before you ship."],
   ["Visit or contact us","We are at HG 66A, Tabere Close, Kileleshwa, Nairobi, or on WhatsApp +254 107 129 273."]],
  faq: [["What does a clearing agent do?","A clearing agent files import documents with KRA, pays duties on your behalf and arranges release of the goods."],["What is an IDF?","The Import Declaration Form is the customs declaration filed for commercial imports into Kenya."],["Do you clear goods you did not ship with us?","Contact us with the cargo details and we will confirm what we can take on."]],
  rel: ["china-to-kenya-shipping","guides/cost-of-importing-from-china-to-kenya","sea-freight-china-kenya"] },
 { slug: "china-sourcing-agent-kenya", nav: "Sourcing agent", type: "Service",
  title: "China Sourcing Agent for Kenya | Verified Suppliers | Baruk",
  desc: "Baruk finds and verifies suppliers in China, negotiates prices and quality-checks goods before shipping to Kenya. No Alibaba guesswork. Quote in 48 hours.",
  h1: "A China sourcing agent for Kenyan buyers",
  lead: "Buying from unknown suppliers online is risky. Baruk finds verified suppliers, negotiates, checks quality and ships to Nairobi, with you paying in M-Pesa.",
  secs: [["How sourcing works","You tell us what you need. We find suppliers, compare prices, negotiate and confirm specifications before anything ships."],
   ["Protecting your money","We only pay suppliers after verification, and you get a reference code and tracking from day one."],
   ["Where we source","China mainly, plus India and the UAE for suitable products."],
   ["What we source","Motorcycle and auto parts, electronics, construction finishings and fittings, home appliances, clothing and more. Individual items have a KES 10,000 minimum."]],
  faq: [["How do I avoid scams when buying from China?","Use a sourcing agent who verifies the supplier and pays only after checks. That is what we do."],["Do I need to know the supplier already?","No. Describe the product and budget, and we find options."],["How is sourcing paid for?","You pay in KES via M-Pesa after approving your landed-cost quote."]],
  rel: ["china-to-kenya-shipping","guides/cost-of-importing-from-china-to-kenya","customs-clearance-nairobi"] },
 { slug: "guides/cost-of-importing-from-china-to-kenya", nav: "Import cost guide", type: "Article",
  title: "Cost of Importing from China to Kenya: What You Really Pay | Baruk",
  desc: "A plain guide to the cost of importing from China to Kenya: product, freight, customs duty, VAT, levies and fees, and how a landed-cost quote adds them up.",
  h1: "The cost of importing from China to Kenya",
  lead: "The price on the supplier's invoice is only part of what an import costs. This guide explains each cost so you can budget properly.",
  secs: [["1. Product cost","What the supplier charges, usually quoted ex-factory or FOB. Sourcing and quality checks may add a fee."],
   ["2. Freight","Air freight is typically charged by weight, and sea freight by volume or container. Air is faster; sea is cheaper for heavy cargo."],
   ["3. Customs duty and taxes","Duty depends on the product's HS code under the EAC tariff. VAT is 16%, and levies such as the Import Declaration Fee and Railway Development Levy apply on the customs value. Rates are set by KRA and change, so always confirm current figures on the KRA site."],
   ["4. Clearing and delivery","Clearing agent charges, port or airport handling and delivery to your premises in Nairobi."],
   ["5. Why a landed-cost quote helps","We add everything into one figure before you commit, so you can compare it with local prices and decide. Send a request for yours."]],
  faq: [["How do I calculate import duty in Kenya?","Find the product's HS code, apply the duty rate to the customs value, then add VAT and the levies on top. KRA publishes the rates and a calculator."],["Is it cheaper to import than to buy locally?","Often, but not always. Compare your landed cost with local prices, which is why we quote it in full."],["Are there hidden costs?","Not with a full landed-cost quote: product, freight, duty and our fee are shown together."]],
  rel: ["china-to-kenya-shipping","sea-freight-china-kenya","customs-clearance-nairobi"] },
];
const MORE = [
 { slug: "import-auto-motorcycle-parts-china-kenya", nav: "Auto & motorcycle parts", type: "Service",
  title: "Import Car & Motorcycle Spare Parts from China to Kenya | Baruk",
  desc: "Import motorcycle parts, engines, brake systems and car accessories from China to Kenya. Verified suppliers, customs clearance and Nairobi delivery.",
  h1: "Import car and motorcycle spare parts from China to Kenya",
  lead: "Mechanics, garages and boda operators often pay far more locally for parts that China makes cheaply. Baruk sources, checks, ships and clears them for you.",
  secs: [["What we source","Motorcycle parts and accessories, engines, brake systems, car spare parts and accessories."],
   ["Getting the right part","Send a photo, part number or the old part's details. We confirm the specification with the supplier before anything ships."],
   ["Quality checks","Parts are verified before shipment, so you are not left guessing from a product listing."],
   ["Landed price","Your quote includes the part, freight, duty and our fee, so you can compare it with your local supplier's price."]],
  faq: [["Can I import a single engine or small batch?","Yes. Individual items have a minimum of KES 10,000, and we can combine parts into one shipment."],["How do I make sure a part will fit?","Give us the vehicle model, year and any part number, and we confirm fitment details with the supplier."],["Do you deliver in Nairobi?","Yes, we deliver to your garage or home in Nairobi."]],
  rel: ["china-sourcing-agent-kenya","air-freight-china-kenya","sea-freight-china-kenya"] },
 { slug: "import-construction-materials-china-kenya", nav: "Construction materials", type: "Service",
  title: "Import Construction Materials & Fittings from China to Kenya | Baruk",
  desc: "Source taps, showerheads, sanitary equipment and construction finishings from China for Kenyan building projects. Customs handled, delivered to site.",
  h1: "Import construction materials and fittings from China to Kenya",
  lead: "Developers and contractors can cut project costs by importing finishings and fittings directly. Baruk handles sourcing, shipping, clearance and delivery to your site.",
  secs: [["What we source","Taps, showerheads, sanitary equipment and other construction finishings and fittings."],
   ["Buying for a whole project","We can source for an entire apartment block or development, matching specifications and quantities."],
   ["Heavy cargo, sensible freight","Bulky materials usually go by sea, and urgent items by air. We recommend the mix that suits your timeline."],
   ["Clearance included","Customs documentation and any required standards checks are part of the service."]],
  faq: [["Is it cheaper to import fittings than buy locally?","Often yes for volume orders. Compare your landed-cost quote with local quotations."],["Do you deliver to construction sites?","Yes, within Nairobi."],["Can you match a sample I already have?","Send photos and specifications and we ask suppliers to match."]],
  rel: ["sea-freight-china-kenya","china-sourcing-agent-kenya","customs-clearance-nairobi"] },
 { slug: "import-electronics-china-kenya", nav: "Electronics & appliances", type: "Service",
  title: "Import Electronics & Home Appliances from China to Kenya | Baruk",
  desc: "Import electronics, gadgets and home appliances from China to Kenya for resale or personal use. Sourcing, shipping, customs clearance and delivery.",
  h1: "Import electronics and home appliances from China to Kenya",
  lead: "Retailers and resellers import electronics and appliances from China to improve margins. Baruk finds suppliers, verifies them and delivers to Nairobi.",
  secs: [["What we source","Electronics and gadgets, home appliances and related accessories."],
   ["Speed matters","Electronics are often high value and fast moving, so air freight in roughly 5–10 days is a common choice."],
   ["Standards and permits","Some electronics need extra checks. Tell us the product and we confirm requirements before you pay."],
   ["Pay in shillings","You pay by M-Pesa after approving a landed-cost quote."]],
  faq: [["Can I import electronics for resale?","Yes. Share the product, quantity and budget for a quote."],["Is there a minimum order?","Individual items have a KES 10,000 minimum."],["Do electronics need special clearance?","Some do. We confirm this before shipping."]],
  rel: ["air-freight-china-kenya","china-sourcing-agent-kenya","customs-clearance-nairobi"] },
 { slug: "dubai-india-to-kenya-shipping", nav: "Dubai & India", type: "Service",
  title: "Dubai & India to Kenya Shipping and Sourcing | Baruk Logistics",
  desc: "Source and ship goods from Dubai (UAE) and India to Kenya. Supplier sourcing, freight, customs clearance and Nairobi delivery with one landed-cost quote.",
  h1: "Sourcing and shipping from Dubai and India to Kenya",
  lead: "China is our main route, but we also source from the UAE and India where they suit your product. The service is the same: one team, one landed-cost quote.",
  secs: [["When to look beyond China","Some products are better sourced from the UAE or India, depending on availability, pricing and specification."],
   ["How it works","Tell us the product and quantity. We find and verify suppliers, arrange freight, clear customs and deliver in Nairobi."],
   ["Ask us first","Send your request and we confirm whether the UAE, India or China gives you the best landed cost."]],
  faq: [["Do you ship from Dubai to Kenya?","We source from the UAE for suitable products. Send your request and we confirm."],["Can I ship from India to Kenya?","Yes, for suitable products. Ask for a quote."],["Is the quote the same format?","Yes, a full landed-cost quote covering product, freight, duty and our fee."]],
  rel: ["china-to-kenya-shipping","china-sourcing-agent-kenya","customs-clearance-nairobi"] },
 { slug: "guides/lcl-vs-fcl-shipping-kenya", nav: "LCL vs FCL guide", type: "Article",
  title: "LCL vs FCL Shipping to Kenya: Which Should You Choose? | Baruk",
  desc: "LCL vs FCL explained for Kenyan importers: how each works, when to choose one, and how groupage helps small traders ship from China.",
  h1: "LCL vs FCL shipping to Kenya: which should you choose?",
  lead: "Choosing between a shared and a full container affects your cost, timing and control. Here is how to decide.",
  secs: [["FCL (full container load)","You rent a whole container. Your goods travel alone, which suits large volumes."],
   ["LCL (less than container load)","Your goods share a container with others, and you pay for the space you use. It suits smaller orders."],
   ["Groupage","Groupage is consolidation of several small shipments into one container, which is how small traders access sea freight."],
   ["How to choose","If your cargo fills most of a container, compare FCL. If not, LCL or groupage usually costs less overall. Send us your cargo details and we compare both."]],
  faq: [["Is LCL slower than FCL?","Shared containers can take longer to consolidate and clear. We confirm timing in your quote."],["What is the minimum for LCL?","It depends on the route. Ask us for your cargo."],["Can I mix air and sea?","Yes. Many importers send urgent items by air and bulk by sea."]],
  rel: ["sea-freight-china-kenya","guides/cost-of-importing-from-china-to-kenya","china-to-kenya-shipping"] },
 { slug: "guides/import-from-alibaba-to-kenya", nav: "Alibaba import guide", type: "Article",
  title: "How to Buy from Alibaba and Ship to Kenya Safely | Baruk Logistics",
  desc: "How to buy from Alibaba and ship to Kenya without getting scammed: verify suppliers, avoid risky prepayment, and handle freight and customs.",
  h1: "How to buy from Alibaba and ship to Kenya safely",
  lead: "Alibaba makes finding suppliers easy but gives no guarantee of quality or delivery. These steps reduce your risk.",
  secs: [["1. Verify the supplier","Check the company's business details, trading history and reviews. Be cautious of prices far below the market."],
   ["2. Order samples first","Test quality before committing to volume, and agree specifications in writing."],
   ["3. Avoid risky payments","Do not send the full amount to an unverified supplier. Use protected payment options or a sourcing agent who pays after verification."],
   ["4. Plan freight and customs","Agree who ships, which route, and how Kenyan customs will be cleared. Price the full landed cost, not just the product."],
   ["5. Or use an agent","Baruk verifies suppliers, pays them after checks, ships and clears your goods, and you pay in M-Pesa."]],
  faq: [["Is Alibaba safe?","Many suppliers are genuine, but you must verify them. Scams exist, especially with unusually low prices."],["Can Baruk buy from Alibaba for me?","Yes. Send the listing or describe the product and we handle sourcing and shipping."],["How do I pay a supplier from Kenya?","Direct supplier payments are complex. With Baruk you pay in KES via M-Pesa."]],
  rel: ["china-sourcing-agent-kenya","china-to-kenya-shipping","guides/cost-of-importing-from-china-to-kenya"] },
];
P.push(...MORE);
by_rel_patch: {
  const add = (s, r) => P.find(p => p.slug === s).rel.push(...r);
  add("china-to-kenya-shipping", ["import-auto-motorcycle-parts-china-kenya","import-construction-materials-china-kenya","import-electronics-china-kenya","dubai-india-to-kenya-shipping","guides/lcl-vs-fcl-shipping-kenya","guides/import-from-alibaba-to-kenya"]);
  add("guides/cost-of-importing-from-china-to-kenya", ["guides/lcl-vs-fcl-shipping-kenya","guides/import-from-alibaba-to-kenya"]);
}
const by = Object.fromEntries(P.map(p => [p.slug, p]));
const biz = { "@type": "LocalBusiness", "@id": SITE + "/#business", name: "Baruk Logistics" };
const page = p => {
  const url = `${SITE}/${p.slug}/`, crumbs = [["Home", SITE + "/"], [p.nav, url]];
  const ld = [
    p.type === "Article"
      ? { "@context": "https://schema.org", "@type": "Article", headline: p.h1, description: p.desc, mainEntityOfPage: url, dateModified: TODAY, author: biz, publisher: biz }
      : { "@context": "https://schema.org", "@type": "Service", name: p.h1, description: p.desc, url, provider: biz, areaServed: { "@type": "Country", name: "Kenya" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: u })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}"><meta name="robots" content="index, follow, max-image-preview:large"><meta name="theme-color" content="#0A0F1E">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="${p.type === "Article" ? "article" : "website"}"><meta property="og:site_name" content="Baruk Logistics"><meta property="og:locale" content="en_KE">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>*{box-sizing:border-box}body{margin:0;font:16px/1.65 'DM Sans',system-ui,sans-serif;background:#0A0F1E;color:#E5E7EB}a{color:#EF4444}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 5%;border-bottom:1px solid #1f2937}header a.b{color:#fff;font-weight:900;font-size:20px;text-decoration:none}
.btn{background:#DC2626;color:#fff!important;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block}
main{max-width:780px;margin:0 auto;padding:40px 5% 24px}h1{font-size:clamp(28px,5vw,44px);line-height:1.1;color:#fff;margin:8px 0 16px}h2{color:#fff;margin:32px 0 6px;font-size:22px}
.lead{font-size:18px;color:#9CA3AF}.crumb{font-size:13px;color:#8A96A8}.crumb a{color:#8A96A8}details{background:#111827;border-radius:10px;padding:12px 16px;margin:8px 0}summary{cursor:pointer;font-weight:700;color:#fff}
.cta{background:#DC2626;border-radius:16px;padding:32px;margin:40px 0;text-align:center;color:#fff}.cta .btn{background:#fff;color:#DC2626!important;margin:6px}
footer{border-top:1px solid #1f2937;padding:28px 5%;font-size:14px;color:#8A96A8}address{font-style:normal}</style></head>
<body><header><a class="b" href="/">Baruk</a><a class="btn" href="/?signup=1">Get a quote</a></header>
<main><div class="crumb"><a href="/">Home</a> › ${esc(p.nav)}</div><h1>${esc(p.h1)}</h1><p class="lead">${esc(p.lead)}</p>
${p.secs.map(([h, t]) => `<h2>${esc(h)}</h2><p>${esc(t)}</p>`).join("\n")}
<h2>Frequently asked questions</h2>
${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
<div class="cta"><h2 style="margin:0 0 8px">Get a full landed-cost quote in 48 hours</h2><a class="btn" href="/?signup=1">Start a shipment</a><a class="btn" href="${WA}">WhatsApp us</a></div>
<h2>Related</h2><p>${p.rel.map(r => `<a href="/${r}/">${esc(by[r].nav)}</a>`).join(" · ")}</p></main>
<footer><address><strong>Baruk Logistics</strong> · ${ADDR} · <a href="${WA}">+254 107 129 273</a> · <a href="mailto:info@baruk.co.ke">info@baruk.co.ke</a></address></footer></body></html>`;
};
for (const p of P) { mkdirSync(`public/${p.slug}`, { recursive: true }); writeFileSync(`public/${p.slug}/index.html`, page(p)); }
const urls = [SITE + "/", ...P.map(p => `${SITE}/${p.slug}/`)];
writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod><priority>${i ? "0.8" : "1.0"}</priority></url>`).join("\n")}\n</urlset>\n`);
console.log("Wrote", P.length, "pages");
