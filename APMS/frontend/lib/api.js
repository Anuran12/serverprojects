const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/projects/apms/api";

export async function api(path, options = {}, token = "") {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Request failed");
  }

  return response.json();
}

/** Multipart POST (do not set Content-Type; browser sets boundary). */
export async function apiForm(path, options = {}, token = "") {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Request failed");
  }

  return response.json();
}

export async function fetchTaskAttachmentBlob(taskId, attachmentId, token) {
  const response = await fetch(
    `${API_BASE}/tasks/${taskId}/attachments/${attachmentId}/file`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store"
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Download failed");
  }
  return response.blob();
}

export { API_BASE };
