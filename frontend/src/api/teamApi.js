import axiosClient from './axiosClient';

export const teamApi = {
  getTeams: async () => {
    const res = await axiosClient.get('/teams');
    return res.data;
  },

  getTeamById: async (id) => {
    const res = await axiosClient.get(`/teams/${id}`);
    return res.data;
  },

  createTeam: async (data) => {
    const res = await axiosClient.post('/teams', data);
    return res.data;
  },

  updateTeam: async (id, data) => {
    const res = await axiosClient.put(`/teams/${id}`, data);
    return res.data;
  },
};

export const dashboardApi = {
  getStats: async () => {
    const res = await axiosClient.get('/dashboard/stats');
    return res.data;
  },
};

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
