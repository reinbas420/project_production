import api from '../axiosInstance';

const cartService = {
  getCart: async () => {
    const response = await api.get('/cart');
    return response.data;
  },

  addToCart: async ({ book_id, library_id, force_replace = false }) => {
    const response = await api.post('/cart/items', {
      book_id,
      library_id,
      force_replace,
    });
    return response.data;
  },

  clearCart: async () => {
    const response = await api.delete('/cart');
    return response.data;
  },

  updateQuantity: async ({ book_id, operation }) => {
    const response = await api.patch('/cart/items/quantity', {
      book_id,
      operation,
    });
    return response.data;
  },
};

export default cartService;
