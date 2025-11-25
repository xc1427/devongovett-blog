#!/usr/bin/env node
/**
 * RSS Feed Generator for Devon's Blog
 * Generates feed.xml from blog post MDX files
 * 
 * Note: RSS readers identify unique entries by the <guid> element.
 * Each post has a stable GUID based on its URL, so rebuilding the feed
 * will not cause duplicate entries in RSS clients.
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://devongovett.me';
const SITE_TITLE = "Devon's Blog";
const SITE_DESCRIPTION = "Devon Govett's blog about JavaScript, bundlers, and web development";

const blogDir = path.join(__dirname, '../src/pages/blog');
const distDir = path.join(__dirname, '../dist');

function extractMetadata(content, filename) {
  const metadata = {};
  
  // Extract exported constants (description, date)
  // Handle strings with escaped quotes inside
  const descMatch = content.match(/export\s+const\s+description\s*=\s*(['"`])((?:\\.|(?!\1).)*)\1/s);
  const dateMatch = content.match(/export\s+const\s+date\s*=\s*(['"`])(.+?)\1/);
  
  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m);
  
  if (descMatch) {
    metadata.description = descMatch[2]
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (dateMatch) metadata.date = dateMatch[2];
  if (titleMatch) metadata.title = titleMatch[1];
  
  // Generate URL from filename
  const slug = filename.replace(/\.mdx$/, '');
  metadata.url = `${SITE_URL}/blog/${slug}.html`;
  metadata.slug = slug;
  
  return metadata;
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRSS(posts) {
  const now = new Date().toUTCString();
  
  const items = posts
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(post => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${post.url}</link>
      <guid isPermaLink="true">${post.url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date + 'T00:00:00Z').toUTCString()}</pubDate>
    </item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function main() {
  // Read all MDX files from blog directory
  const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.mdx'));
  
  const posts = files.map(file => {
    const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');
    return extractMetadata(content, file);
  }).filter(post => post.title && post.date);

  // Deduplicate posts by slug (in case of any file system issues)
  const seenSlugs = new Set();
  const uniquePosts = posts.filter(post => {
    if (seenSlugs.has(post.slug)) {
      console.warn(`⚠ Skipping duplicate post: ${post.slug}`);
      return false;
    }
    seenSlugs.add(post.slug);
    return true;
  });

  const rss = generateRSS(uniquePosts);
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Write feed.xml (overwrites existing file to ensure no stale data)
  const feedPath = path.join(distDir, 'feed.xml');
  fs.writeFileSync(feedPath, rss, 'utf-8');
  
  console.log(`✓ Generated RSS feed with ${uniquePosts.length} posts: ${feedPath}`);
}

main();
