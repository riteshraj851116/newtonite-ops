import axiosClient from './axiosClient';

export const authApi = {
  login: async (credentials) => {
    const res = await axiosClient.post('/auth/login', credentials);
    return res.data;
  },

  getMe: async () => {
    const res = await axiosClient.get('/auth/me');
    return res.data;
  },
};
