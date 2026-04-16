import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:8000/api' : '/api',
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message;
    console.error('API Error:', message);
    return Promise.reject(err);
  }
);

export default api;
