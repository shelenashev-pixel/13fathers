#!/usr/bin/env node
/**
 * Generates static multilingual SEO pages (EN, RU, KA) for the homepage and all 13 Assyrian Fathers,
 * plus robots.txt and sitemap.xml for https://13fathers.ge/.
 *
 * Usage: node scripts/build-seo.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://13fathers.ge';
const LANGS = ['en', 'ru', 'ka'];
const DEFAULT_LANG = 'en';

const HOME_SEO = {
  en: {
    siteName: '13 Assyrian Fathers in Georgia',
    title: '13 Assyrian Fathers in Georgia — Interactive Map of Monasteries',
    description:
      'Interactive map and guide to the 13 Assyrian Fathers (Syrian monks) of 6th-century Georgia: Ioane of Zedazeni, Davit of Gareja, Shio of Mgvime, Abibos of Nekresi, Anton of Martqopi, and their monasteries.',
    ogLocale: 'en_US',
    altNames: ['Thirteen Assyrian Fathers', '13 Syrian Fathers', 'Assyrian Monks in Georgia'],
    breadcrumbHome: '13 Assyrian Fathers'
  },
  ru: {
    siteName: '13 Ассирийских отцов в Грузии',
    title: '13 ассирийских отцов в Грузии — интерактивная карта монастырей ассирийских монахов',
    description:
      'Интерактивная карта и путеводитель по монастырям 13 ассирийских отцов (сирийских монахов) VI века в Грузии: Иоанн Зедазнийский, Давид Гареджийский, Шио Мгвимский, Абибос Некресский, Антоний Марткопский и другие.',
    ogLocale: 'ru_RU',
    altNames: ['Ассирийские отцы', 'Ассирийские монахи', '13 отцов в Грузии', 'Тринадцать сирийских отцов'],
    breadcrumbHome: '13 ассирийских отцов'
  },
  ka: {
    siteName: '13 ასურელი მამა საქართველოში',
    title: '13 ასურელი მამა საქართველოში — მონასტრების ინტერაქტიული რუკა',
    description:
      'VI საუკუნის 13 ასურელი მამის მონასტრების ინტერაქტიული რუკა და გზამკვლევი საქართველოში: იოანე ზედაზნელი, დავით გარეჯელი, შიო მღვიმელი, აბიბოს ნეკრესელი, ანტონ მარტყოფელი და სხვები.',
    ogLocale: 'ka_GE',
    altNames: ['ასურელი მამები', 'ცამეტი ასურელი მამა', 'ასურელი ბერები'],
    breadcrumbHome: '13 ასურელი მამა'
  }
};

// Common alternative Russian/English spellings for search matching in JSON-LD
const MONK_ALT_NAMES = {
  'ioane-zedazeni': {
    ru: ['Иоанн Зедазенский', 'Иоанн Зедазнийский', 'Иоанн из Зедазени'],
    en: ['John of Zedazeni', 'Ioane Zedazneli']
  },
  'stepane-khirsa': {
    ru: ['Стефан Хирсский', 'Стефан Хирский', 'Степан Хирсский'],
    en: ['Stephen of Khirsa', 'Stepane Khirseli']
  },
  'abibos-nekresi': {
    ru: ['Авив Некресский', 'Абибос Некресский', 'Авив из Некреси'],
    en: ['Abibus of Nekresi', 'Abibos Nekreseli']
  },
  'tadeoz-stepantsminda': {
    ru: ['Фаддей Степанцминдский', 'Тадеоз Степанцминдский', 'Фаддей Тетрахевский'],
    en: ['Thaddeus of Stepantsminda', 'Tadeoz Stepantsmindeli']
  },
  'zenon-ikhalto': {
    ru: ['Зенон Икалтойский', 'Зенон Икалтский', 'Зинон Икалтойский'],
    en: ['Zeno of Ikhalto', 'Zenon Iqaltoeli']
  },
  'davit-gareja': {
    ru: ['Давид Гареджийский', 'Давид Гареджи', 'Давид Гареджелийский'],
    en: ['David of Gareja', 'David Garejeli', 'David Gareji']
  },
  'ioseb-alaverdi': {
    ru: ['Иосиф Алавердский', 'Иосеб Алавердский'],
    en: ['Joseph of Alaverdi', 'Ioseb Alaverdeli']
  },
  'anton-martqopi': {
    ru: ['Антоний Марткопский', 'Антон Марткопский'],
    en: ['Anthony of Martqopi', 'Anton Martkopeli']
  },
  'ise-tsilkani': {
    ru: ['Исе Цилканский', 'Иессей Цилканский', 'Есе Цилканский'],
    en: ['Jesse of Tsilkani', 'Iese Tsilkneli']
  },
  'shio-mgvime': {
    ru: ['Шио Мгвимский', 'Симеон Мгвимский', 'Шио Мгвимели'],
    en: ['Shio of Mgvime', 'Shio Mgvimeli']
  },
  'isidor-samtavisi': {
    ru: ['Исидор Самтависский', 'Исидор Самтавнели'],
    en: ['Isidore of Samtavisi', 'Isidore Samtavneli']
  },
  'piros-breti': {
    ru: ['Пирр Бретский', 'Пирос Бретский'],
    en: ['Pyrrhus of Breti', 'Piros Breteli']
  },
  'mikhail-ulumbo': {
    ru: ['Михаил Улумбойский', 'Михаил Улумбийский'],
    en: ['Michael of Ulumbo', 'Mikael Ulumboeli']
  }
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateText(str, maxLen = 160) {
  const clean = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).replace(/[.,;:!?—-]+$/, '')}…`;
}

function buildPath(lang, monkId = null) {
  const parts = [];
  if (lang !== DEFAULT_LANG) parts.push(lang);
  if (monkId) parts.push(monkId);
  return parts.length ? `/${parts.join('/')}/` : '/';
}

function buildUrl(lang, monkId = null) {
  return `${SITE_ORIGIN}${buildPath(lang, monkId)}`;
}

function resolveAssetUrl(relPath) {
  const normalized = String(relPath || '').replace(/^\.\//, '');
  return `${SITE_ORIGIN}/${normalized}`;
}

function getMonkImageUrl(monk) {
  return resolveAssetUrl(monk.imageUrl || `./images/monasteries/${monk.id}.webp`);
}

function getMonkIconPath(monk) {
  return monk.iconUrl || `./images/icons/${monk.id}.webp`;
}

function getLocalizedMonk(monk, locale) {
  const loc = locale.monks?.[monk.id] || {};
  return {
    id: monk.id,
    name: loc.name || monk.name,
    monastery: loc.monastery || monk.monastery,
    region: loc.region || monk.region,
    sections: Array.isArray(loc.sections) ? loc.sections : (monk.detailSections || []).map((s) => s.paragraphs || [])
  };
}

function buildHreflangLinks(monkId = null) {
  const lines = LANGS.map(
    (lang) => `  <link rel="alternate" hreflang="${lang}" href="${buildUrl(lang, monkId)}">`
  );
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${buildUrl(DEFAULT_LANG, monkId)}">`);
  return lines.join('\n');
}

function buildHomeJsonLd(lang, monks, locale) {
  const meta = HOME_SEO[lang];
  const url = buildUrl(lang);
  const items = monks.map((monk, idx) => {
    const loc = getLocalizedMonk(monk, locale);
    const altNames = MONK_ALT_NAMES[monk.id]?.[lang] || [];
    const person = {
      '@type': 'Person',
      name: loc.name,
      ...(altNames.length ? { alternateName: altNames } : {}),
      url: buildUrl(lang, monk.id),
      image: getMonkImageUrl(monk),
      description: truncateText(loc.sections?.[0]?.[0] || `${loc.name} — ${loc.monastery}`, 220)
    };
    return {
      '@type': 'ListItem',
      position: idx + 1,
      url: buildUrl(lang, monk.id),
      item: person
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: meta.siteName,
        alternateName: meta.altNames,
        inLanguage: LANGS
      },
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: meta.title,
        description: meta.description,
        inLanguage: lang,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          name: meta.siteName,
          numberOfItems: monks.length,
          itemListElement: items
        }
      }
    ]
  };
}

function buildMonkJsonLd(lang, monk, locale) {
  const meta = HOME_SEO[lang];
  const loc = getLocalizedMonk(monk, locale);
  const url = buildUrl(lang, monk.id);
  const homeUrl = buildUrl(lang);
  const altNames = MONK_ALT_NAMES[monk.id]?.[lang] || [];
  const bio = (loc.sections?.[0] || []).join(' ');
  const monasteryDesc = (loc.sections?.[1] || []).join(' ');
  const [lng, lat] = Array.isArray(monk.coordinates) ? monk.coordinates : [null, null];

  const monasteryNode = {
    '@type': 'LandmarksOrHistoricalBuildings',
    '@id': `${url}#monastery`,
    name: loc.monastery,
    description: truncateText(monasteryDesc || bio, 300),
    image: getMonkImageUrl(monk),
    address: {
      '@type': 'PostalAddress',
      addressRegion: loc.region,
      addressCountry: 'GE'
    },
    ...(lat != null && lng != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: lat,
            longitude: lng
          }
        }
      : {}),
    ...(monk.gmapsUrl ? { hasMap: monk.gmapsUrl } : {})
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: meta.breadcrumbHome,
            item: homeUrl
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: loc.name,
            item: url
          }
        ]
      },
      {
        '@type': 'Person',
        '@id': `${url}#person`,
        name: loc.name,
        ...(altNames.length ? { alternateName: altNames } : {}),
        description: truncateText(bio, 350),
        image: getMonkImageUrl(monk),
        url,
        workLocation: { '@id': `${url}#monastery` }
      },
      monasteryNode
    ]
  };
}

function buildMetaBlock({ lang, title, description, canonicalUrl, ogImage, monkId, jsonLd, isSubpage }) {
  const meta = HOME_SEO[lang];
  const baseTag = isSubpage ? '  <base href="/">\n' : '';
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return [
    `${baseTag}  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <meta name="robots" content="index, follow">`,
    `  <link rel="canonical" href="${canonicalUrl}">`,
    buildHreflangLinks(monkId),
    `  <meta property="og:type" content="${monkId ? 'article' : 'website'}">`,
    `  <meta property="og:site_name" content="${escapeHtml(meta.siteName)}">`,
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:url" content="${canonicalUrl}">`,
    `  <meta property="og:image" content="${ogImage}">`,
    `  <meta property="og:locale" content="${meta.ogLocale}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:image" content="${ogImage}">`,
    `  <script type="application/ld+json">${safeJsonLd}</script>`
  ].join('\n');
}

function buildPrerenderedListHtml(lang, monks, locale) {
  return monks
    .map((monk, idx) => {
      const loc = getLocalizedMonk(monk, locale);
      const href = buildPath(lang, monk.id);
      return [
        `        <a id="card-${monk.id}" class="monk-card" href="${href}">`,
        `          <span class="card-number">${idx + 1}</span>`,
        `          <span class="card-icon-frame"><img src="${escapeHtml(getMonkIconPath(monk))}" alt="" width="48" height="48" loading="lazy" decoding="async"></span>`,
        `          <span class="card-copy">`,
        `            <h3 data-i18n="monks.${monk.id}.name">${escapeHtml(loc.name)}</h3>`,
        `            <p data-i18n="monks.${monk.id}.monastery">${escapeHtml(loc.monastery)}</p>`,
        `          </span>`,
        `        </a>`
      ].join('\n');
    })
    .join('\n');
}

function buildModalSectionsHtml(lang, monk, locale) {
  if (!monk) {
    const introSections = Array.isArray(locale.intro?.sections) ? locale.intro.sections : [];
    return introSections
      .map((sec) => {
        const parts = [];
        if (sec.heading) parts.push(`<h3>${escapeHtml(sec.heading)}</h3>`);
        if (Array.isArray(sec.paragraphs)) {
          sec.paragraphs.forEach((p) => parts.push(`<p>${escapeHtml(p)}</p>`));
        }
        if (Array.isArray(sec.bullets) && sec.bullets.length) {
          const lis = sec.bullets
            .map((b) => `<li>${b.lead ? `<strong>${escapeHtml(b.lead)}</strong> ` : ''}${escapeHtml(b.text || '')}</li>`)
            .join('');
          parts.push(`<ul>${lis}</ul>`);
        }
        return `<section>${parts.join('')}</section>`;
      })
      .join('');
  }

  const loc = getLocalizedMonk(monk, locale);
  const monasteryHeading = locale.sections?.monastery || 'Monastery';
  return loc.sections
    .map((paragraphs, idx) => {
      if (!Array.isArray(paragraphs) || !paragraphs.length) return '';
      const heading = idx === 1 ? `<h3>${escapeHtml(monasteryHeading)}</h3>` : '';
      const ps = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      return `<section>${heading}${ps}</section>`;
    })
    .filter(Boolean)
    .join('');
}

function renderPageHtml(template, { lang, monk, monkIndex, monks, locale, isSubpage }) {
  const meta = HOME_SEO[lang];
  const monkId = monk ? monk.id : null;
  const canonicalUrl = buildUrl(lang, monkId);
  const defaultOgImage = resolveAssetUrl('./images/monasteries/david-gareji.webp');

  let title = meta.title;
  let description = meta.description;
  let ogImage = defaultOgImage;
  let jsonLd;
  let modalName = locale.intro?.title || meta.siteName;
  let modalIndexText = '1';

  if (monk) {
    const loc = getLocalizedMonk(monk, locale);
    title = `${loc.name} — ${loc.monastery} | ${meta.siteName}`;
    const firstParagraph = loc.sections?.[0]?.[0] || '';
    const prefix =
      lang === 'ru'
        ? `${loc.name} (${loc.monastery}, ${loc.region}) — один из 13 ассирийских отцов в Грузии. `
        : lang === 'ka'
          ? `${loc.name} (${loc.monastery}, ${loc.region}) — 13 ასურელი მამიდან ერთ-ერთი. `
          : `${loc.name} (${loc.monastery}, ${loc.region}) — one of the 13 Assyrian Fathers in Georgia. `;
    description = truncateText(prefix + firstParagraph, 165);
    ogImage = getMonkImageUrl(monk);
    jsonLd = buildMonkJsonLd(lang, monk, locale);
    modalName = loc.name;
    modalIndexText = String(monkIndex);
  } else {
    jsonLd = buildHomeJsonLd(lang, monks, locale);
  }

  const metaBlock = buildMetaBlock({
    lang,
    title,
    description,
    canonicalUrl,
    ogImage,
    monkId,
    jsonLd,
    isSubpage
  });

  let html = template;

  // 1. Update <html lang="..." ...>
  const htmlTag = monkId
    ? `<html lang="${lang}" data-monk-id="${monkId}">`
    : `<html lang="${lang}">`;
  html = html.replace(/<html\b[^>]*>/, htmlTag);

  // 2. Replace SEO meta slot
  html = html.replace(
    /<!-- SEO_META_START -->[\s\S]*?<!-- SEO_META_END -->/,
    `<!-- SEO_META_START -->\n${metaBlock}\n  <!-- SEO_META_END -->`
  );

  // 3. Localize visible header title and counter
  const appTitle = locale.app?.title || meta.siteName;
  html = html.replace(
    /(<h1 class="app-title"[^>]*>)[\s\S]*?(<\/h1>)/,
    `$1${escapeHtml(appTitle)}$2`
  );
  html = html.replace(
    /(<span id="counter"[^>]*>)[\s\S]*?(<\/span>)/,
    `$1${monks.length}$2`
  );

  // 4. Prerender the crawlable list of all 13 monks inside #monks-list
  const listHtml = buildPrerenderedListHtml(lang, monks, locale);
  html = html.replace(
    /(<div id="monks-list"[^>]*>)[\s\S]*?(<\/div>\s*<\/aside>)/,
    `$1\n${listHtml}\n      $2`
  );

  // 5. Prerender localized detail text inside #modal-monk-name & #modal-monk-desc
  html = html.replace(
    /(<span id="modal-monk-index">)[\s\S]*?(<\/span>)/,
    `$1${escapeHtml(modalIndexText)}$2`
  );
  html = html.replace(
    /(<h2 id="modal-monk-name">)[\s\S]*?(<\/h2>)/,
    `$1${escapeHtml(modalName)}$2`
  );
  const modalDescHtml = buildModalSectionsHtml(lang, monk, locale);
  html = html.replace(
    /(<div id="modal-monk-desc">)[\s\S]*?(<\/div>)/,
    `$1${modalDescHtml}$2`
  );

  return html;
}

function buildSitemapXml(monks) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];

  const addEntry = (lang, monkId = null) => {
    const loc = buildUrl(lang, monkId);
    const priority = monkId ? '0.8' : '1.0';
    const alternates = [
      ...LANGS.map((altLang) => `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${buildUrl(altLang, monkId)}" />`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${buildUrl(DEFAULT_LANG, monkId)}" />`
    ].join('\n');

    entries.push(
      [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>monthly</changefreq>`,
        `    <priority>${priority}</priority>`,
        alternates,
        '  </url>'
      ].join('\n')
    );
  };

  for (const lang of LANGS) addEntry(lang, null);
  for (const monk of monks) {
    for (const lang of LANGS) addEntry(lang, monk.id);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}

function buildRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    ''
  ].join('\n');
}

function writePage(relFilePath, content) {
  const fullPath = path.join(ROOT_DIR, relFilePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function main() {
  const templatePath = path.join(ROOT_DIR, 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  if (!template.includes('<!-- SEO_META_START -->') || !template.includes('<!-- SEO_META_END -->')) {
    throw new Error('Missing SEO_META_START / SEO_META_END markers in index.html');
  }

  const monks = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'monks.json'), 'utf8'));
  const locales = Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'locales', `${lang}.json`), 'utf8'))
    ])
  );

  let generatedCount = 0;

  // Generate homepages: / (index.html), /ru/index.html, /ka/index.html
  for (const lang of LANGS) {
    const relPath = lang === DEFAULT_LANG ? 'index.html' : path.join(lang, 'index.html');
    const html = renderPageHtml(template, {
      lang,
      monk: null,
      monkIndex: 0,
      monks,
      locale: locales[lang],
      isSubpage: lang !== DEFAULT_LANG
    });
    writePage(relPath, html);
    generatedCount += 1;
  }

  // Generate 13 monk pages × 3 languages = 39 pages
  monks.forEach((monk, idx) => {
    for (const lang of LANGS) {
      const relPath =
        lang === DEFAULT_LANG
          ? path.join(monk.id, 'index.html')
          : path.join(lang, monk.id, 'index.html');
      const html = renderPageHtml(template, {
        lang,
        monk,
        monkIndex: idx + 1,
        monks,
        locale: locales[lang],
        isSubpage: true
      });
      writePage(relPath, html);
      generatedCount += 1;
    }
  });

  writePage('sitemap.xml', buildSitemapXml(monks));
  writePage('robots.txt', buildRobotsTxt());

  console.log(`Generated ${generatedCount} HTML pages, sitemap.xml, and robots.txt.`);
}

main();
