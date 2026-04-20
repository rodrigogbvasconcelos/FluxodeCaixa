import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // Normalize error message for toast display
    const msg = error.response?.data?.error
      || error.response?.data?.message
      || (error.code === 'ECONNABORTED' ? 'Tempo de resposta esgotado' : null)
      || (!navigator.onLine ? 'Sem conexão com a internet' : null)
      || 'Erro ao comunicar com o servidor';
    error.userMessage = msg;
    return Promise.reject(error);
  }
);

export default api;
