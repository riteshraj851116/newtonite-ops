import axiosClient from './axiosClient';

const getSummary = async () => {
  const res = await axiosClient.get('/dashboard/summary');
  return res.data;
};

export const dashboardApi = {
  getSummary,
  getStats: getSummary,
};

export default dashboardApi;
