import api from '../axiosInstance';

export type NotificationPlatform = 'android' | 'ios' | 'web';

const notificationService = {
  registerToken: async (token: string, platform: NotificationPlatform) => {
    const response = await api.post('/notifications/register-token', { token, platform });
    return response.data;
  },

  removeToken: async (token: string) => {
    const response = await api.delete('/notifications/remove-token', { data: { token } });
    return response.data;
  },
};

export default notificationService;
