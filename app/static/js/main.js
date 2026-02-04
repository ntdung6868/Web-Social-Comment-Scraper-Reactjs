/**
 * ===========================================
 * main.js - JavaScript chính cho Web Scraper
 * ===========================================
 *
 * File này xử lý:
 * - Toast notifications
 * - AJAX requests cho scraping
 * - Progress bar updates
 * - Modal handling
 */

// ===========================================
// TRANSLATION HELPER
// ===========================================

/**
 * Lấy translation từ window.TRANSLATIONS
 * @param {string} key - Key của translation
 * @returns {string} Translated text hoặc key nếu không tìm thấy
 */
function _(key) {
  return window.TRANSLATIONS && window.TRANSLATIONS[key] ? window.TRANSLATIONS[key] : key;
}

// ===========================================
// TOAST NOTIFICATIONS
// ===========================================

/**
 * Hiển thị toast notification
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo (success, error, warning, info)
 * @param {number} duration - Thời gian hiển thị (ms)
 */
function showToast(message, type = "info", duration = 5000) {
  const container = document.getElementById("toast-container");

  // Tạo toast element
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  // Icon theo loại
  const icons = {
    success:
      '<svg class="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
    error:
      '<svg class="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
    warning:
      '<svg class="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
    info: '<svg class="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
  };

  toast.innerHTML = `
        <div class="flex items-center">
            ${icons[type] || icons.info}
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="closeToast(this)">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
        </button>
    `;

  container.appendChild(toast);

  // Tự động ẩn sau duration
  setTimeout(() => {
    closeToast(toast.querySelector(".toast-close"));
  }, duration);
}

/**
 * Đóng toast notification
 * @param {HTMLElement} button - Nút đóng
 */
function closeToast(button) {
  const toast = button.closest(".toast");
  if (toast) {
    toast.classList.add("hiding");
    setTimeout(() => toast.remove(), 300);
  }
}

// ===========================================
// CSRF TOKEN
// ===========================================

/**
 * Lấy CSRF token từ meta tag
 * @returns {string} CSRF token
 */
function getCsrfToken() {
  const tokenMeta = document.querySelector('meta[name="csrf-token"]');
  return tokenMeta ? tokenMeta.getAttribute("content") : "";
}

// ===========================================
// SCRAPE FUNCTIONALITY
// ===========================================

/**
 * Xử lý submit form scrape
 */
document.addEventListener("DOMContentLoaded", function () {
  const scrapeForm = document.getElementById("scrape-form");

  if (scrapeForm) {
    scrapeForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const urlInput = document.getElementById("url");
      const scrapeBtn = document.getElementById("scrape-btn");
      const scrapeBtnText = document.getElementById("scrape-btn-text");
      const progressSection = document.getElementById("progress-section");
      const progressBar = document.getElementById("progress-bar");
      const progressText = document.getElementById("progress-text");

      const url = urlInput.value.trim();

      if (!url) {
        showToast(_("toast_enter_url"), "warning");
        return;
      }

      // Validate URL
      if (!url.includes("tiktok.com") && !url.includes("facebook.com") && !url.includes("fb.watch")) {
        showToast(_("toast_invalid_url"), "error");
        return;
      }

      // Disable button và hiển thị loading
      scrapeBtn.disabled = true;
      // Thay đổi icon thành spinner (xoay icon hiện tại)
      const svgIcon = scrapeBtn.querySelector("svg");
      if (svgIcon) svgIcon.classList.add("animate-spin");
      scrapeBtnText.textContent = _("scraping");

      // Hiện progress section
      progressSection.classList.remove("hidden");

      // Lấy element hiển thị số comment
      const commentCount = document.getElementById("comment-count");

      // Simulate progress bar (vì scraping thực tế không có progress %)
      let progress = 0;
      const progressInterval = setInterval(() => {
        if (progress < 90) {
          progress += Math.random() * 5;
          if (progress > 90) progress = 90;
          progressBar.style.width = progress + "%";
          progressText.textContent = Math.round(progress) + "%";
        }
      }, 1000);

      // Poll real comment count từ server
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/scrape/progress");
          const data = await res.json();
          if (data.total > 0) {
            commentCount.textContent = `(${_("scraped")}: ${data.total} ${_("comments").toLowerCase()})`;
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 1500);

      try {
        // Gửi request scrape
        const response = await fetch("/api/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
          },
          body: JSON.stringify({ url: url }),
        });

        const data = await response.json();

        // Dừng intervals
        clearInterval(progressInterval);
        clearInterval(pollInterval);

        if (data.success) {
          // Hoàn thành progress
          progressBar.style.width = "100%";
          progressText.textContent = "100%";

          // Cập nhật số comment thực tế
          const commentCount = document.getElementById("comment-count");
          commentCount.textContent = `(${_("completed")}: ${data.data.total_comments} ${_("comments").toLowerCase()})`;
          commentCount.classList.remove("text-emerald-600");
          commentCount.classList.add("text-green-600", "font-bold");

          // Hiện toast thông báo và reload trang
          showToast(`${_("toast_scrape_success").replace("{count}", data.data.total_comments)}`, "success");

          // Reload trang sau 1 giây
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          clearInterval(pollInterval);
          progressSection.classList.add("hidden");
          commentCount.textContent = "";
          showToast(data.error || _("toast_error"), "error", 10000);
        }
      } catch (error) {
        clearInterval(progressInterval);
        clearInterval(pollInterval);
        progressSection.classList.add("hidden");
        commentCount.textContent = "";
        showToast(_("toast_connection_error"), "error");
        console.error("Scrape error:", error);
      } finally {
        // Enable button lại và dừng xoay icon
        scrapeBtn.disabled = false;
        const svgIcon = scrapeBtn.querySelector("svg");
        if (svgIcon) svgIcon.classList.remove("animate-spin");
        scrapeBtnText.textContent = _("start_scrape");
      }
    });
  }
});

// ===========================================
// DELETE HISTORY
// ===========================================

/**
 * Xóa lịch sử scrape
 * @param {number} historyId - ID của history cần xóa
 */
async function deleteHistory(historyId) {
  if (!confirm(_("toast_confirm_delete"))) {
    return;
  }

  try {
    const response = await fetch(`/api/history/${historyId}`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": getCsrfToken(),
      },
    });

    const data = await response.json();

    if (data.success) {
      showToast(_("toast_delete_success"), "success");
      // Reload trang
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || _("toast_error"), "error");
    }
  } catch (error) {
    showToast(_("toast_connection_error"), "error");
    console.error("Delete error:", error);
  }
}

// ===========================================
// COMMENTS MODAL
// ===========================================

/**
 * Load và hiển thị comments trong modal
 * @param {number} historyId - ID của history
 */
async function loadComments(historyId) {
  const modal = document.getElementById("comments-modal");
  const commentsList = document.getElementById("comments-list");

  // Hiện modal
  modal.classList.remove("hidden");
  commentsList.innerHTML = `<div class="text-center py-8"><span class="spinner inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></span><p class="mt-2 text-gray-500">${_("loading_comments")}</p></div>`;

  try {
    const response = await fetch(`/api/history/${historyId}/comments`, {
      headers: {
        "X-CSRFToken": getCsrfToken(),
      },
    });

    const data = await response.json();

    if (data.success) {
      if (data.data.comments.length === 0) {
        commentsList.innerHTML = `<p class="text-center text-gray-500 py-8">${_("no_comments")}</p>`;
      } else {
        commentsList.innerHTML = data.data.comments
          .map(
            (comment, index) => `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center">
                                <div class="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-medium">
                                    ${comment.username.charAt(0).toUpperCase()}
                                </div>
                                <div class="ml-3">
                                    <p class="font-medium text-gray-900">${escapeHtml(comment.username)}</p>
                                </div>
                            </div>
                            <span class="text-sm text-gray-500">#${index + 1}</span>
                        </div>
                        <p class="mt-3 text-gray-700">${escapeHtml(comment.content)}</p>
                        ${comment.likes > 0 ? `<p class="mt-2 text-sm text-gray-500">❤️ ${comment.likes} likes</p>` : ""}
                    </div>
                `,
          )
          .join("");
      }
    } else {
      commentsList.innerHTML = `<p class="text-center text-red-500 py-8">${data.error || _("toast_error")}</p>`;
    }
  } catch (error) {
    commentsList.innerHTML = `<p class="text-center text-red-500 py-8">${_("toast_connection_error")}</p>`;
    console.error("Load comments error:", error);
  }
}

/**
 * Đóng modal comments
 */
function closeCommentsModal() {
  const modal = document.getElementById("comments-modal");
  modal.classList.add("hidden");
}

// Đóng modal khi click ra ngoài
document.addEventListener("click", function (e) {
  const modal = document.getElementById("comments-modal");
  if (modal && e.target === modal) {
    closeCommentsModal();
  }
});

// Đóng modal khi nhấn ESC
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeCommentsModal();
  }
});

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Escape HTML để tránh XSS
 * @param {string} text - Text cần escape
 * @returns {string} Text đã escape
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format số với K, M
 * @param {number} num - Số cần format
 * @returns {string} Số đã format
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Copy text to clipboard
 * @param {string} text - Text cần copy
 */
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast(_("toast_copied"), "success", 2000);
    })
    .catch((err) => {
      showToast(_("toast_copy_failed"), "error");
      console.error("Copy failed:", err);
    });
}
