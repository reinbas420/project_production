import api from '../axiosInstance';

export type CatalogAuthorSearchResult = {
  key: string;
  name: string;
  topWork: string | null;
  workCount: number;
  birthDate: string | null;
  deathDate: string | null;
  ratingsAverage: number;
  ratingsCount: number;
};

export type CatalogAuthorDetails = {
  key: string;
  name: string;
  bio: string | null;
  birthDate: string | null;
  deathDate: string | null;
  alternateNames: string[];
  topSubjects: string[];
  works: Array<{
    key: string | null;
    title: string;
    firstPublishYear: string | number | null;
    subjects: string[];
  }>;
};

export type CatalogPublisherSearchResult = {
  name: string;
  mentions: number;
  sampleTitles: string[];
};

export type CatalogPublisherDetails = {
  name: string;
  location: string | null;
  founded: string | null;
  website: string | null;
  description: string | null;
  books: Array<{
    title: string;
    firstPublishYear: number | null;
    authorNames: string[];
  }>;
};

const catalogService = {
  searchAuthors: async (q: string, limit = 10): Promise<CatalogAuthorSearchResult[]> => {
    const response = await api.get('/catalog/authors/search', { params: { q, limit } });
    return response.data?.data?.authors || [];
  },

  getAuthorDetails: async (authorKey: string): Promise<CatalogAuthorDetails> => {
    const key = String(authorKey || '').replace('/authors/', '');
    const response = await api.get(`/catalog/authors/${encodeURIComponent(key)}`);
    return response.data?.data?.author;
  },

  searchPublishers: async (q: string, limit = 12): Promise<CatalogPublisherSearchResult[]> => {
    const response = await api.get('/catalog/publishers/search', { params: { q, limit } });
    return response.data?.data?.publishers || [];
  },

  getPublisherDetails: async (name: string): Promise<CatalogPublisherDetails> => {
    const response = await api.get('/catalog/publishers/details', { params: { name } });
    return response.data?.data?.publisher;
  },
};

export default catalogService;
