const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function api(path, options = {}) {
  const token = localStorage.getItem("issuebuddy-token");
  const isFormData = options.body instanceof FormData;
  const headers = { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event("issuebuddy:unauthorized"));
    const details = payload.details && typeof payload.details === "object" ? Object.values(payload.details).flat().join(" ") : "";
    throw new Error(details || payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

export const toStatus = (value) => ({ OPEN: "Open", IN_PROGRESS: "In progress", REVIEW: "Review", CLOSED: "Closed" })[value] || value;
export const toPriority = (value) => value ? value[0] + value.slice(1).toLowerCase() : "—";
export const formatDate = (value) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
