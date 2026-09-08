import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`,
          { refreshToken }
        );
        const newToken = res.data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── MCH Lab Endpoints ───
api.createLabOrder = (data) => api.post("/mch/lab/order/", data);
api.confirmLabPayment = (data) => api.post("/mch/lab/confirm-payment/", data);
api.submitLabResult = (data) => api.post("/mch/lab/submit-result/", data);
api.getLabOrders = (params) => api.get("/mch/lab/orders/", { params });
// ─── MCH Lab Endpoints ───
api.createLabOrder = (data) => api.post("/mch/lab/order/", data);
api.confirmLabPayment = (data) => api.post("/mch/lab/confirm-payment/", data);
api.submitLabResult = (data) => api.post("/mch/lab/submit-result/", data);
api.getLabOrders = (params) => api.get("/mch/lab/orders/", { params });
// ─── MCH Lab Endpoints ───
api.createLabOrder = (data) => api.post("/mch/lab/order/", data);
api.confirmLabPayment = (data) => api.post("/mch/lab/confirm-payment/", data);
api.submitLabResult = (data) => api.post("/mch/lab/submit-result/", data);
api.getLabOrders = (params) => api.get("/mch/lab/orders/", { params });
// ─── MCH Lab Endpoints ───
api.createLabOrder = (data) => api.post("/mch/lab/order/", data);
api.confirmLabPayment = (data) => api.post("/mch/lab/confirm-payment/", data);
api.submitLabResult = (data) => api.post("/mch/lab/submit-result/", data);
api.getLabOrders = (params) => api.get("/mch/lab/orders/", { params });
// ─── MCH Lab Endpoints ───
api.createLabOrder = (data) => api.post("/mch/lab/order/", data);
api.confirmLabPayment = (data) => api.post("/mch/lab/confirm-payment/", data);
api.submitLabResult = (data) => api.post("/mch/lab/submit-result/", data);
api.getLabOrders = (params) => api.get("/mch/lab/orders/", { params });
export default api;
