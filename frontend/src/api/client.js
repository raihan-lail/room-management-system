const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:5000");

export default async function apiRequest(
  path,
  { headers, responseType, ...options } = {}
) {
  const isFormData = options.body instanceof FormData;
  const activeSiteId = localStorage.getItem("activeSiteId");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(activeSiteId ? { "X-Site-Id": activeSiteId } : {}),
      ...(headers || {}),
    },
  });

  if (!response.ok) {
    let data;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const error = new Error((data && data.message) || "Request failed");

    error.status = response.status;
    error.data = data;

    throw error;
  }

  if (responseType === "blob") {
    return response.blob();
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}
