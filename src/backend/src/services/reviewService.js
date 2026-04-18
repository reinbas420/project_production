const axios = require('axios');
const cheerio = require('cheerio');
const UnifiedReview = require('../models/UnifiedReview');

exports.fetchAggregatedReviews = async (isbn, bookId = null) => {
  const aggregated = [];

  const normalizedIsbn = String(isbn || '').replace(/[-\s]/g, '').trim();
  if (!normalizedIsbn || normalizedIsbn.length < 10) return aggregated;

  const existing = await UnifiedReview.findOne({ isbn: normalizedIsbn }).lean();
  if (existing?.reviews?.length) {
    return existing.reviews.map((entry) => ({
      source: entry.source,
      text: entry.text,
    }));
  }

  // 1. Primary: Try Google Books API for Official Editorial Synopsis
  try {
    const googleRes = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${normalizedIsbn}`, { timeout: 6000 });
    if (googleRes.data.items && googleRes.data.items.length > 0) {
      const description = googleRes.data.items[0].volumeInfo.description;
      if (description && description.length > 30) {
        // Strip out any HTML bold/italic tags returned by Google
        const cleanText = description.replace(/<[^>]*>?/gm, '');
        aggregated.push({ source: 'Google Books', text: cleanText });
      }
    }
  } catch (error) {
    console.warn(`[ReviewService] Google Books synopsis fetch failed for ${normalizedIsbn}`, error.message);
  }

  // 2. Secondary: If Google returns nothing, fallback to Goodreads Web Scraping
  if (aggregated.length === 0) {
    try {
      const url = `https://www.goodreads.com/book/isbn/${normalizedIsbn}`;
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 8000
      });

      const $ = cheerio.load(data);
      const reviews = [];

      // Modern UI class
      $('.ReviewText__content').each((i, el) => {
        if (i < 5) reviews.push($(el).text().trim());
      });

      // Legacy UI class fallback
      if (reviews.length === 0) {
        $('.reviewText span.readable').each((i, el) => {
          if (i < 5) reviews.push($(el).text().trim());
        });
      }

      reviews.forEach(text => {
        if (text.length > 20) {
          aggregated.push({ source: 'Goodreads', text });
        }
      });
    } catch (error) {
      console.warn(`[ReviewService] Failed to scrape Goodreads fallback for ${normalizedIsbn}`, error.message);
    }
  }

  // 3. Absolute Fallback to physically prove the pipeline is active despite ISBN matching blocks
  if (aggregated.length === 0) {
    aggregated.push({
      source: 'System',
      text: "We couldn't find live text reviews for this exact ISBN on Google or Goodreads. If this is a newly added test book with a dummy ISBN (or if external APIs blocked the fetch), community reviews won't attach!"
    });
  }

  const reviewEntries = aggregated.map((review) => ({
    source: review.source,
    text: review.text,
    importedAt: new Date(),
  }));

  await UnifiedReview.findOneAndUpdate(
    { isbn: normalizedIsbn },
    {
      isbn: normalizedIsbn,
      ...(bookId ? { bookId } : {}),
      reviews: reviewEntries,
      comments: reviewEntries,
      lastImportedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return aggregated;
};
