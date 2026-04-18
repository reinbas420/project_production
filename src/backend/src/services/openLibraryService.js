const axios = require('axios');
const AppError = require('../utils/AppError');

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';

const openLibraryClient = axios.create({
  baseURL: OPEN_LIBRARY_BASE_URL,
  timeout: 10000,
  headers: {
    'User-Agent': 'HyperLocalCloudLibrary/1.0',
  },
});

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeAuthorKey = (authorKey) => {
  const cleaned = String(authorKey || '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('/authors/')) return cleaned;
  return `/authors/${cleaned}`;
};

exports.searchAuthors = async (query, limit = 10) => {
  const q = String(query || '').trim();
  if (!q) {
    throw new AppError('Query parameter q is required', 400);
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);

  const { data } = await openLibraryClient.get('/search/authors.json', {
    params: { q, limit: safeLimit },
  });

  const authors = asArray(data?.docs).map((doc) => ({
    key: String(doc.key || ''),
    name: String(doc.name || 'Unknown Author'),
    topWork: doc.top_work || null,
    workCount: Number(doc.work_count || 0),
    birthDate: doc.birth_date || null,
    deathDate: doc.death_date || null,
    ratingsAverage: Number(doc.ratings_average || 0),
    ratingsCount: Number(doc.ratings_count || 0),
  }));

  return authors;
};

exports.getAuthorDetails = async (authorKey) => {
  const key = normalizeAuthorKey(authorKey);
  if (!key) {
    throw new AppError('Author key is required', 400);
  }

  const [{ data: authorData }, { data: worksData }] = await Promise.all([
    openLibraryClient.get(`${key}.json`),
    openLibraryClient.get(`${key}/works.json`, { params: { limit: 12 } }),
  ]);

  const bio =
    typeof authorData?.bio === 'string'
      ? authorData.bio
      : authorData?.bio?.value || null;

  const works = asArray(worksData?.entries).map((entry) => ({
    key: entry.key || null,
    title: entry.title || 'Untitled',
    firstPublishYear: entry.first_publish_date || entry.first_publish_year || null,
    subjects: asArray(entry.subjects).slice(0, 5),
  }));

  return {
    key,
    name: authorData?.name || 'Unknown Author',
    bio,
    birthDate: authorData?.birth_date || null,
    deathDate: authorData?.death_date || null,
    alternateNames: asArray(authorData?.alternate_names).slice(0, 8),
    topSubjects: asArray(authorData?.top_subjects).slice(0, 10),
    works,
  };
};

exports.searchPublishers = async (query, limit = 12) => {
  const q = String(query || '').trim();
  if (!q) {
    throw new AppError('Query parameter q is required', 400);
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 30);

  const { data } = await openLibraryClient.get('/search.json', {
    params: { publisher: q, limit: 80 },
  });

  const docs = asArray(data?.docs);
  const map = new Map();

  for (const doc of docs) {
    const publishers = asArray(doc.publisher);
    for (const name of publishers) {
      const normalized = String(name || '').trim();
      if (!normalized) continue;
      if (!normalized.toLowerCase().includes(q.toLowerCase())) continue;

      if (!map.has(normalized)) {
        map.set(normalized, {
          name: normalized,
          mentions: 0,
          sampleTitles: [],
        });
      }

      const item = map.get(normalized);
      item.mentions += 1;
      if (doc.title && item.sampleTitles.length < 3 && !item.sampleTitles.includes(doc.title)) {
        item.sampleTitles.push(doc.title);
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, safeLimit);
};

exports.getPublisherDetails = async (publisherName) => {
  const name = String(publisherName || '').trim();
  if (!name) {
    throw new AppError('Publisher name is required', 400);
  }

  let publisherData = null;
  try {
    const { data } = await openLibraryClient.get(`/publishers/${encodeURIComponent(name)}.json`);
    publisherData = data;
  } catch (error) {
    // Some publishers do not have a dedicated /publishers/{name}.json object.
    publisherData = null;
  }

  const { data: searchData } = await openLibraryClient.get('/search.json', {
    params: { publisher: name, limit: 15 },
  });

  const books = asArray(searchData?.docs).map((doc) => ({
    title: doc.title || 'Untitled',
    firstPublishYear: doc.first_publish_year || null,
    authorNames: asArray(doc.author_name).slice(0, 3),
  }));

  return {
    name,
    location: publisherData?.location || null,
    founded: publisherData?.founded || publisherData?.established || null,
    website: publisherData?.website || null,
    description:
      typeof publisherData?.description === 'string'
        ? publisherData.description
        : publisherData?.description?.value || null,
    books,
  };
};
