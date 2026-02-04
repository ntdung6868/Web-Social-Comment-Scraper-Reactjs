// Background service worker
const DEFAULT_SERVER = "http://localhost:5000";

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "grabAndSendCookies") {
    grabAndSendCookies(request.platform, request.token, request.serverUrl)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function grabAndSendCookies(platform, tokenFromPage, serverUrlFromPage) {
  try {
    // Get settings - prefer token from page, fallback to stored token
    const data = await chrome.storage.sync.get(["serverUrl", "token"]);
    const serverUrl = serverUrlFromPage || data.serverUrl || DEFAULT_SERVER;
    const token = tokenFromPage || data.token;

    if (!token) {
      return {
        success: false,
        error: "no_token",
        message: "Chưa có token! Hãy vào Extension Settings và nhập token trước.",
      };
    }

    // Save token for future use (from popup)
    if (tokenFromPage) {
      await chrome.storage.sync.set({ token: tokenFromPage, serverUrl: serverUrl });
    }

    // Determine domain based on platform
    let domains;
    let checkCookieName;

    if (platform === "tiktok") {
      // Grab from multiple TikTok domains to get all cookies
      domains = [".tiktok.com", "www.tiktok.com", "tiktok.com"];
      checkCookieName = "sessionid";
    } else if (platform === "facebook") {
      domains = [".facebook.com", "www.facebook.com", "facebook.com"];
      checkCookieName = "c_user";
    } else {
      return { success: false, error: "invalid_platform" };
    }

    // Get cookies from all domains
    let allCookies = [];
    const seenCookies = new Set();

    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain: domain });
      for (const cookie of cookies) {
        const key = `${cookie.name}:${cookie.domain}`;
        if (!seenCookies.has(key)) {
          seenCookies.add(key);
          allCookies.push(cookie);
        }
      }
    }

    const cookies = allCookies;

    // Log grabbed cookie names for debugging
    console.log(
      `Grabbed ${cookies.length} cookies for ${platform}:`,
      cookies.map((c) => c.name),
    );

    // Check if logged in
    const hasSession = cookies.some((c) => c.name === checkCookieName);

    if (!hasSession) {
      return {
        success: false,
        error: "not_logged_in",
        message: `Bạn chưa đăng nhập ${platform === "tiktok" ? "TikTok" : "Facebook"}!`,
      };
    }

    if (cookies.length === 0) {
      return {
        success: false,
        error: "no_cookies",
        message: "Không tìm thấy cookies!",
      };
    }

    // Format cookies
    const formattedCookies = {
      url: platform === "tiktok" ? "https://www.tiktok.com" : "https://www.facebook.com",
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
      return {
        success: true,
        count: cookies.length,
        message: result.message,
      };
    } else {
      return {
        success: false,
        error: result.message || "Server error",
      };
    }
  } catch (error) {
    console.error("grabAndSendCookies error:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
