import fs from "node:fs/promises";
import path from "node:path";
import TurndownService from "turndown";
import { load } from "cheerio";

const BASE_URL = "https://docs.wwebjs.dev";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const OUTPUT_ROOT = path.resolve("docs/exports/wwebjs");
const SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".json",
  ".xml",
  ".pdf",
  ".ico",
  ".gif",
  ".zip",
  ".map",
  ".webp",
  ".mp4",
  ".mp3",
]);

const TURNDOWN = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
  emDelimiter: "*",
});

TURNDOWN.addRule("preserveCodeLanguage", {
  filter: (node) => node.nodeName === "PRE" && node.children,
  replacement: (_content, node) => {
    const codeChild = Array.from(node.childNodes || []).find(
      (child) => child.nodeName === "CODE",
    );
    if (!codeChild) {
      const text = node.textContent || "";
      return `\n\n\`\`\`\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    }
    const className = codeChild.getAttribute && codeChild.getAttribute("class");
    const langMatch = className && className.match(/language-([\w-]+)/i);
    const lang = langMatch ? langMatch[1] : "";
    const textContent = codeChild.textContent || "";
    return `\n\n\`\`\`${lang}\n${textContent.replace(/\n$/, "")}\n\`\`\`\n\n`;
  },
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function slugFromUrl(url) {
  const trimmed = url.replace(BASE_URL, "").replace(/^[\/]+/, "");
  if (!trimmed) return "index";
  return trimmed;
}

function normalizeUrl(inputUrl, base = BASE_URL) {
  try {
    const resolved = new URL(inputUrl, base);
    if (!resolved.href.startsWith(BASE_URL)) return null;
    resolved.hash = "";
    resolved.search = "";
    let pathname = resolved.pathname || "";
    pathname = pathname.replace(/\/+/g, "/");
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.replace(/\/$/, "");
    }
    if (pathname === "/") {
      pathname = "";
    }
    const ext = path.extname(pathname);
    if (ext && ext !== ".html" && SKIP_EXTENSIONS.has(ext)) {
      return null;
    }
    return `${resolved.origin}${pathname}`;
  } catch (error) {
    return null;
  }
}

async function collectSitemapUrls(rootUrl, seen = new Set()) {
  if (seen.has(rootUrl)) return [];
  seen.add(rootUrl);
  const res = await fetch(rootUrl, {
    headers: { "User-Agent": "wwebjs-doc-exporter/1.0" },
  });
  if (!res.ok) {
    console.error(`Failed to fetch sitemap ${rootUrl}: ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const locs = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g), (match) =>
    match[1].trim(),
  );
  if (xml.includes("<sitemapindex")) {
    const nested = [];
    for (const loc of locs) {
      nested.push(...(await collectSitemapUrls(loc, seen)));
    }
    return nested;
  }
  return locs.map((loc) => normalizeUrl(loc)).filter((loc) => Boolean(loc));
}

async function crawlByLinks(startUrl) {
  console.warn("Falling back to link-based crawl");
  const normalizedStart = normalizeUrl(startUrl);
  if (!normalizedStart) {
    throw new Error(`Unable to normalize start URL: ${startUrl}`);
  }
  const queue = [normalizedStart];
  const enqueued = new Set(queue);
  const discovered = new Set();
  const urls = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current || discovered.has(current)) {
      continue;
    }
    discovered.add(current);
    try {
      const html = await fetchPageContent(current);
      urls.push(current);
      const $ = load(html);
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        const normalized = normalizeUrl(href, current);
        if (!normalized) return;
        if (discovered.has(normalized) || enqueued.has(normalized)) return;
        enqueued.add(normalized);
        queue.push(normalized);
      });
      await delay(150);
    } catch (error) {
      console.error(`Error crawling ${current}:`, error.message);
    }
  }
  return urls;
}

async function fetchPageContent(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "wwebjs-doc-exporter/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

function prepareHtmlForMarkdown(html, url) {
  const $ = load(html);
  $("script, style, noscript, iframe, svg").remove();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("/")) {
      $(el).attr("href", new URL(href, BASE_URL).toString());
    }
  });

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.startsWith("/")) {
      $(el).attr("src", new URL(src, BASE_URL).toString());
    }
  });

  const main = $("main");
  const content = main.length ? main.html() : $("body").html();
  if (!content) {
    console.warn(`No content found for ${url}`);
    return "";
  }
  return content;
}

function toMarkdown(contentHtml, url) {
  const markdown = TURNDOWN.turndown(contentHtml);
  const frontmatter = [
    "---",
    `source: ${url}`,
    `captured_at: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  return `${frontmatter}${markdown.trim()}\n`;
}

async function writeMarkdown(url, markdown) {
  const slug = slugFromUrl(url);
  const parts = slug.split("/").filter(Boolean);
  const fileName = parts.length ? `${parts.pop()}.md` : "index.md";
  const dir = path.join(OUTPUT_ROOT, parts.join("/"));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, markdown, "utf8");
  return path.relative(process.cwd(), filePath);
}

async function main() {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  console.log(`Collecting sitemap entries from ${SITEMAP_URL}`);
  let urls = Array.from(new Set(await collectSitemapUrls(SITEMAP_URL))).sort();
  if (urls.length === 0) {
    urls = await crawlByLinks(BASE_URL);
  }
  urls = urls.map((url) => normalizeUrl(url) || null).filter(Boolean);
  urls.push(BASE_URL);
  urls = Array.from(new Set(urls)).sort();
  console.log(`Found ${urls.length} documentation pages.`);
  const writtenFiles = [];
  for (const [index, url] of urls.entries()) {
    try {
      console.log(`[${index + 1}/${urls.length}] Fetching ${url}`);
      const html = await fetchPageContent(url);
      const contentHtml = prepareHtmlForMarkdown(html, url);
      const markdown = toMarkdown(contentHtml, url);
      const filePath = await writeMarkdown(url, markdown);
      writtenFiles.push({ url, file: filePath });
      await delay(250);
    } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
    }
  }

  const indexPath = path.join(OUTPUT_ROOT, "docs-index.json");
  await fs.writeFile(indexPath, JSON.stringify(writtenFiles, null, 2));
  console.log(
    `Export completed. Index written to ${path.relative(process.cwd(), indexPath)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
