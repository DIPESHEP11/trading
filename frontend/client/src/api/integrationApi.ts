import axiosInstance from './axiosInstance';

export const integrationApi = {
  whatsapp: {
    sendMessage: (to: string, body: string) =>
      axiosInstance.post('/integrations/whatsapp/send/', { to, body }).then((r) => r.data),
  },
  meta: {
    getUserInfo: (userId: string) =>
      axiosInstance.get(`/integrations/meta/user/${userId}/`).then((r) => r.data),
  },
};
