import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export const loginUser = (username, password) =>
  api.post("/login", { username, password }).then((r) => r.data);

export const fetchServers = () => api.get("/servers").then((r) => r.data);

export const fetchMetrics = (serverId) =>
  api
    .get(`/metrics${serverId ? `?server=${serverId}` : ""}`)
    .then((r) => r.data);

export const fetchMysql = (serverId) =>
  api.get(`/mysql${serverId ? `?server=${serverId}` : ""}`).then((r) => r.data);

export const fetchMikrotik = () => api.get("/mikrotik").then((r) => r.data);
