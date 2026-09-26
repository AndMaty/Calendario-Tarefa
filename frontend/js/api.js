const API = (() => {
  const BASE_URL = "http://localhost:5000/api";

  function getToken() {
    return localStorage.getItem("ct_token");
  }

  function setToken(token) {
    localStorage.setItem("ct_token", token);
  }

  function clearToken() {
    localStorage.removeItem("ct_token");
    localStorage.removeItem("ct_user");
  }

  function getUser() {
    const raw = localStorage.getItem("ct_user");
    return raw ? JSON.parse(raw) : null;
  }

  function setUser(user) {
    localStorage.setItem("ct_user", JSON.stringify(user));
  }

  async function request(path, { method = "GET", body = null, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });
    } catch (networkError) {
      throw new Error(
        "Não foi possível conectar ao servidor. Verifique se o backend Flask está rodando em " +
          BASE_URL
      );
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_e) {
      data = null;
    }

    if (response.status === 401 && auth) {
      clearToken();
      window.location.hash = "#/login";
    }

    if (!response.ok) {
      const message = (data && data.error) || `Erro ${response.status}`;
      throw new Error(message);
    }

    return data;
  }

  return {
    getToken, setToken, clearToken, getUser, setUser,

    register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
    me: () => request("/auth/me"),

    listTasks: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/tasks${qs ? `?${qs}` : ""}`);
    },
    getTask: (id) => request(`/tasks/${id}`),
    createTask: (payload) => request("/tasks", { method: "POST", body: payload }),
    updateTask: (id, payload) => request(`/tasks/${id}`, { method: "PUT", body: payload }),
    updateTaskStatus: (id, status) =>
      request(`/tasks/${id}/status`, { method: "PATCH", body: { status } }),
    deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

    listTags: () => request("/tags"),
    createTag: (payload) => request("/tags", { method: "POST", body: payload }),
    updateTag: (id, payload) => request(`/tags/${id}`, { method: "PUT", body: payload }),
    deleteTag: (id) => request(`/tags/${id}`, { method: "DELETE" }),

    listHolidays: (year, country = "BR") =>
      request(`/holidays?year=${year}&country=${country}`),

    dashboardStats: () => request("/dashboard/stats"),
  };
})();