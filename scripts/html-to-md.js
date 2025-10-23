const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../whatsapp-web.js/docs');
const outputDir = path.join(__dirname, '../docs/export');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simple HTML to Markdown converter
function htmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>|<\/ul>/gi, '')
    .replace(/<ol[^>]*>|<\/ol>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// Process HTML files
const htmlFiles = fs.readdirSync(docsDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
  const htmlPath = path.join(docsDir, file);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const markdown = htmlToMarkdown(html);
  const mdFile = file.replace('.html', '.md');
  const mdPath = path.join(outputDir, mdFile);
  
  fs.writeFileSync(mdPath, markdown);
  console.log(`Converted ${file} -> ${mdFile}`);
});

console.log(`\nConverted ${htmlFiles.length} files to ${outputDir}`);