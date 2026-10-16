import axiosClient from './axiosClient';

export const userApi = {
  getUsers: async (params = {}) => {
    const res = await axiosClient.get('/users', { params });
    return res.data;
  },

  getUserById: async (id) => {
    const res = await axiosClient.get(`/users/${id}`);
    return res.data;
  },

  updateRole: async (id, role) => {
    const res = await axiosClient.put(`/users/${id}/role`, { role });
    return res.data;
  },
};
