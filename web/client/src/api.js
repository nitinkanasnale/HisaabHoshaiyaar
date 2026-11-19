export async function api(path, body, method) {
  const res = await fetch("/api" + path, {
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    method: method || (body ? "POST" : "GET"),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res
    .json()
    .catch(() => ({ detail: "Server returned an invalid response." }));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("hh:unauthorized"));
    throw new Error(data.detail || "Request failed.");
  }
  return data;
}
