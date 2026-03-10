import { logger } from '../../../lib/logger.js';

const RSS_URL = 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en';

const decodeEntities = (value = '') =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const readTag = (xml, tagName) => {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1]?.trim() || '';
};

const readImage = (description = '') => {
  const decoded = decodeEntities(description);
  const match = decoded.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] || '';
};

export const GET = async () => {
  try {
    logger.info('GET /api/news/global.json');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(RSS_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'personal-dashboard/1.0' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Google News RSS request failed', { status: response.status });
      return new Response(JSON.stringify({ items: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const xml = await response.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const items = itemMatches.slice(0, 10).map((itemXml) => {
      const title = decodeEntities(readTag(itemXml, 'title'));
      const link = readTag(itemXml, 'link');
      const pubDate = readTag(itemXml, 'pubDate');
      const source = decodeEntities(readTag(itemXml, 'source'));
      const description = readTag(itemXml, 'description');
      const image = readImage(description);
      return { title, link, pubDate, source, image };
    }).filter((item) => item.title && item.link);

    return new Response(JSON.stringify({ items }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('GET /api/news/global.json failed', { error: error.message });
    return new Response(JSON.stringify({ items: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
