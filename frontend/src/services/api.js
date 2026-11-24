import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = window.location.pathname;
    const rutaPublica = path.startsWith('/b/') || path.startsWith('/cancelar/');
    if (error.response?.status === 401 && path !== '/' && !rutaPublica) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
