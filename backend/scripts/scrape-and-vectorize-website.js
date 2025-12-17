/**
 * Scrape Newbury Partners Website and Vectorize to Pinecone
 * 
 * This script:
 * 1. Fetches all URLs from sitemap
 * 2. Scrapes content from each page
 * 3. Extracts key information and context
 * 4. Vectorizes to Pinecone for AI agent access
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

const SITEMAP_URL = 'https://newburypartners.com/page-sitemap.xml';
const DELAY_BETWEEN_PAGES = 2000; // 2 seconds to be respectful

// Priority pages to scrape first
const PRIORITY_PAGES = [
  'https://newburypartners.com/',
  'https://newburypartners.com/about-us/',
  'https://newburypartners.com/staffing-technology/',
  'https://newburypartners.com/bullhorn-implementation/',
  'https://newburypartners.com/ai-enablement-leadership/',
  'https://newburypartners.com/business-intelligence-and-analytics/',
  'https://newburypartners.com/testimonials/',
  'https://newburypartners.com/case-studies/',
];

async function fetchSitemapURLs() {
  try {
    const response = await axios.get(SITEMAP_URL);
    const urls = [];
    const locMatches = response.data.match(/<loc>(.*?)<\/loc>/g);
    
    if (locMatches) {
      locMatches.forEach(match => {
        const url = match.replace(/<\/?loc>/g, '');
        urls.push(url);
      });
    }
    
    return urls;
  } catch (error) {
    console.error('Error fetching sitemap:', error.message);
    return [];
  }
}

async function scrapePage(url) {
  try {
    console.log(`\n📄 Scraping: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewburryBot/1.0; +https://newburypartners.com)',
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script, style, and nav elements
    $('script, style, nav, footer, header').remove();
    
    // Extract title
    const title = $('title').text() || $('h1').first().text() || url.split('/').pop();
    
    // Extract meta description
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Extract main content
    const mainContent = $('main, article, .content, #content, body').first();
    
    // Extract headings for structure
    const headings = [];
    mainContent.find('h1, h2, h3').each((i, el) => {
      headings.push($(el).text().trim());
    });
    
    // Extract paragraphs
    const paragraphs = [];
    mainContent.find('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        paragraphs.push(text);
      }
    });
    
    // Extract lists
    const lists = [];
    mainContent.find('ul, ol').each((i, el) => {
      const items = [];
      $(el).find('li').each((j, li) => {
        items.push($(li).text().trim());
      });
      if (items.length > 0) {
        lists.push(items.join('; '));
      }
    });
    
    // Combine all content
    const fullText = [
      title,
      description,
      ...headings,
      ...paragraphs,
      ...lists
    ].filter(Boolean).join('\n\n');
    
    // Clean up whitespace
    const cleanedText = fullText
      .replace(/\s+/g, ' ')
      .replace(/\n\s+\n/g, '\n\n')
      .trim();
    
    console.log(`   ✅ Extracted ${cleanedText.length} characters`);
    console.log(`   📊 Headings: ${headings.length}, Paragraphs: ${paragraphs.length}`);
    
    return {
      url,
      title: title.trim(),
      description: description.trim(),
      content: cleanedText,
      headings,
      wordCount: cleanedText.split(/\s+/).length,
    };
    
  } catch (error) {
    console.error(`   ❌ Error scraping ${url}:`, error.message);
    return null;
  }
}

async function vectorizeContent(pageData) {
  try {
    console.log(`   🔍 Creating embedding...`);
    
    // Create embedding (768 dimensions for Pinecone)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      dimensions: 768,
      input: pageData.content.substring(0, 8000), // OpenAI limit
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    // Create unique ID
    const id = `website_${pageData.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Prepare metadata
    const metadata = {
      source_type: 'website',
      url: pageData.url,
      title: pageData.title.substring(0, 500),
      description: pageData.description.substring(0, 1000),
      content: pageData.content.substring(0, 35000), // Pinecone limit
      word_count: pageData.wordCount,
      headings: pageData.headings.slice(0, 10).join(', '),
      indexed_at: new Date().toISOString(),
    };
    
    // Upsert to Pinecone
    await index.upsert([{
      id,
      values: embedding,
      metadata,
    }]);
    
    console.log(`   ✅ Vectorized to Pinecone: ${id}`);
    return { success: true, id };
    
  } catch (error) {
    console.error(`   ❌ Vectorization error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Newbury Partners website scraping and vectorization...\n');
  
  // Check environment variables
  if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing API keys');
    process.exit(1);
  }
  
  // Fetch sitemap URLs
  console.log('📄 Fetching sitemap...');
  let urls = await fetchSitemapURLs();
  console.log(`✅ Found ${urls.length} URLs in sitemap\n`);
  
  // Prioritize important pages
  const priorityUrls = urls.filter(url => PRIORITY_PAGES.includes(url));
  const otherUrls = urls.filter(url => !PRIORITY_PAGES.includes(url));
  urls = [...priorityUrls, ...otherUrls];
  
  console.log(`📌 Processing ${priorityUrls.length} priority pages first\n`);
  
  let scraped = 0;
  let vectorized = 0;
  let errors = 0;
  
  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
    
    // Scrape page
    const pageData = await scrapePage(url);
    
    if (!pageData) {
      errors++;
      continue;
    }
    
    scraped++;
    
    // Vectorize to Pinecone
    const result = await vectorizeContent(pageData);
    
    if (result.success) {
      vectorized++;
    } else {
      errors++;
    }
    
    console.log(`   📊 Progress: ${scraped} scraped, ${vectorized} vectorized, ${errors} errors`);
    
    // Delay between pages
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES));
    }
  }
  
  console.log('\n✅ Website scraping and vectorization complete!');
  console.log(`   Total URLs: ${urls.length}`);
  console.log(`   Scraped: ${scraped}`);
  console.log(`   Vectorized: ${vectorized}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

