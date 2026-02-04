// Social Cookie Grabber - Support TikTok & Facebook
const DEFAULT_SERVER = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkAllLoginStatus();
  setupListeners();
});

async function loadSettings() {
  try {
    const data = await chrome.storage.sync.get(["serverUrl", "token"]);
    if (data.serverUrl) {
      document.getElementById("server-url").value = data.serverUrl;
    }
    if (data.token) {
      document.getElementById("token").value = data.token;
    }
  } catch (e) {
    console.error("Load settings error:", e);
  }
}

async function checkAllLoginStatus() {
  await checkLoginStatus("tiktok", ".tiktok.com", "sessionid", "msToken");
  await checkLoginStatus("facebook", ".facebook.com", "c_user", "xs");
}

async function checkLoginStatus(platform, domain, sessionCookie, secondaryCookie) {
  const statusEl = document.getElementById(`${platform}-status`);
  const btnGrab = document.getElementById(`btn-grab-${platform}`);
  const cookieInfo = document.getElementById(`${platform}-info`);

  try {
    const cookies = await chrome.cookies.getAll({ domain: domain });
    const hasSession = cookies.some((c) => c.name === sessionCookie);
    const hasSecondary = cookies.some((c) => c.name === secondaryCookie);

    const platformName = platform === "tiktok" ? "TikTok" : "Facebook";

    if (hasSession) {
      statusEl.className = "status success";
      statusEl.textContent = `✅ Đã đăng nhập ${platformName}`;
      btnGrab.disabled = false;
      cookieInfo.textContent = `${cookies.length} cookies (${secondaryCookie}: ${hasSecondary ? "✅" : "❌"})`;
    } else {
      statusEl.className = "status error";
      statusEl.textContent = `❌ Chưa đăng nhập ${platformName}`;
      btnGrab.disabled = true;
      cookieInfo.textContent = "";
    }
  } catch (e) {
    statusEl.className = "status error";
    statusEl.textContent = "❌ Lỗi kiểm tra cookie";
    btnGrab.disabled = true;
  }
}

function setupListeners() {
  document.getElementById("btn-grab-tiktok").addEventListener("click", () => grabAndSend("tiktok"));
  document.getElementById("btn-grab-facebook").addEventListener("click", () => grabAndSend("facebook"));
  document.getElementById("btn-save").addEventListener("click", saveSettings);
}

async function grabAndSend(platform) {
  const btn = document.getElementById(`btn-grab-${platform}`);
  const resultEl = document.getElementById(`${platform}-result`);
  const originalText = btn.innerHTML;

  const platformName = platform === "tiktok" ? "TikTok" : "Facebook";
  const domain = platform === "tiktok" ? ".tiktok.com" : ".facebook.com";
  const url = platform === "tiktok" ? "https://www.tiktok.com" : "https://www.facebook.com";

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Đang lấy cookie...';
    resultEl.className = "result";
    resultEl.style.display = "none";

    // Get settings
    const data = await chrome.storage.sync.get(["serverUrl", "token"]);
    const serverUrl = data.serverUrl || DEFAULT_SERVER;
    const token = data.token;

    if (!token) {
      throw new Error('Chưa có token! Hãy nhập token và bấm "Lưu & Kết nối" trước.');
    }

    // Get cookies
    const cookies = await chrome.cookies.getAll({ domain: domain });

    if (cookies.length === 0) {
      throw new Error(`Không có cookie ${platformName}! Hãy đăng nhập trước.`);
    }

    // Format cookies
    const formattedCookies = {
      url: url,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate,
      })),
    };

    // Send to server
    btn.innerHTML = '<span class="loading"></span>Đang gửi đến server...';

    const response = await fetch(`${serverUrl}/api/extension/save-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Token": token,
      },
      body: JSON.stringify({
        platform: platform,
        cookies: formattedCookies,
      }),
    });

    const result = await response.json();

    if (result.success) {
      resultEl.className = "result success show";
      resultEl.textContent = "✅ " + result.message;
    } else {
      throw new Error(result.message || "Lỗi không xác định");
    }
  } catch (e) {
    resultEl.className = "result error show";
    resultEl.textContent = "❌ " + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function saveSettings() {
  const btn = document.getElementById("btn-save");
  const resultEl = document.getElementById("save-result");
  const serverUrl = document.getElementById("server-url").value.trim() || DEFAULT_SERVER;
  const token = document.getElementById("token").value.trim();

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Đang lưu...';

    await chrome.storage.sync.set({ serverUrl, token });

    if (token) {
      btn.innerHTML = '<span class="loading"></span>Đang kết nối...';

      const response = await fetch(`${serverUrl}/api/extension/verify-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Token": token,
        },
      });

      const data = await response.json();

      if (data.success) {
        resultEl.className = "result success show";
        resultEl.textContent = `✅ Đã kết nối! Xin chào ${data.username}`;
      } else {
        resultEl.className = "result error show";
        resultEl.textContent = "❌ Token không hợp lệ: " + data.message;
      }
    } else {
      resultEl.className = "result success show";
      resultEl.textContent = "✅ Đã lưu cài đặt!";
    }
  } catch (e) {
    resultEl.className = "result error show";
    resultEl.textContent = "❌ Lỗi: " + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "💾 Lưu & Kết nối";
  }
}
