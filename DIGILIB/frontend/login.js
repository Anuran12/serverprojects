const API_BASE = window.__API_BASE__ || "/api";

async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error("Invalid credentials");
  }

  return response.json();
}

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.querySelector(".btn.primary");
  loginBtn.addEventListener("click", async () => {
    const username = document.querySelector("input[type='text']").value.trim();
    const password = document.querySelector("input[type='password']").value.trim();

    if (!username || !password) {
      alert("Enter username and password.");
      return;
    }

    try {
      const data = await login(username, password);
      localStorage.setItem("audit_token", data.access_token);
      window.location.href = "index.html";
    } catch (err) {
      alert("Login failed.");
    }
  });
});
