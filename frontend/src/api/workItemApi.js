import axiosClient from './axiosClient';

const getItems = async (params = {}) => {
  const res = await axiosClient.get('/items', { params });
  return res.data;
};

const getItemById = async (id) => {
  const res = await axiosClient.get(`/items/${id}`);
  return res.data;
};

const createItem = async (data, idempotencyKey) => {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const res = await axiosClient.post('/items', data, { headers });
  return res.data;
};

const updateItem = async (id, data) => {
  const res = await axiosClient.patch(`/items/${id}`, data);
  return res.data;
};

const claimItem = async (id) => {
  const res = await axiosClient.post(`/items/${id}/claim`);
  return res.data;
};

const transitionItem = async (id, status, version, note = '') => {
  const res = await axiosClient.post(`/items/${id}/transition`, {
    status,
    version,
    note,
  });
  return res.data;
};

const getActivity = async (id) => {
  const res = await axiosClient.get(`/items/${id}/activity`);
  return res.data;
};

const getComments = async (id) => {
  const res = await axiosClient.get(`/items/${id}/comments`);
  return res.data;
};

const addComment = async (id, content) => {
  const res = await axiosClient.post(`/items/${id}/comments`, { content });
  return res.data;
};

export const workItemApi = {
  getItems,
  getWorkItems: getItems,
  getItemById,
  getWorkItemById: getItemById,
  createItem,
  createWorkItem: createItem,
  updateItem,
  updateWorkItem: updateItem,
  claimItem,
  claimWorkItem: claimItem,
  transitionItem,
  getActivity,
  getActivityHistory: getActivity,
  getComments,
  addComment,
};

export default workItemApi;
