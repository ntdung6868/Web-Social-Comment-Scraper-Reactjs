import customtkinter as ctk
import threading
import os
from tkinter import filedialog
from cookie_forge_core import run_cookie_forge

class CookieForgeApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("CookieForge v3.0 — Verified Session Exporter")

        app_width = 450
        app_height = 700
        screen_height = self.winfo_screenheight()

        # Logic vị trí:
        # Browser (scraper core) dùng width=420.
        # Nên App sẽ đặt ở x=450 để nằm ngay bên cạnh.
        pos_x = 450
        pos_y = (screen_height - app_height) // 2

        self.geometry(f"{app_width}x{app_height}+{pos_x}+{pos_y}")

        ctk.set_appearance_mode("dark")
        self.configure(fg_color="#0f172a")

        self.cookie_path = ctk.StringVar()
        self.stop_event = threading.Event()

        # --- UI SETUP ---
        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.pack(fill="both", expand=True, padx=20, pady=20)

        # Header
        ctk.CTkLabel(self.main_frame, text="COOKIE FORGE", font=("Arial", 24, "bold"), text_color="#38bdf8").pack(pady=(10, 5))
        ctk.CTkLabel(self.main_frame, text="Warm TikTok session, solve captcha, export verified cookies.", font=("Arial", 12), text_color="#94a3b8").pack(pady=(0, 4))
        ctk.CTkLabel(self.main_frame, text="Output: ~/Downloads/tiktok-verified-session-*.json", font=("Consolas", 10), text_color="#64748b").pack(pady=(0, 18))

        # File Select
        self.card = ctk.CTkFrame(self.main_frame, fg_color="#1e293b", corner_radius=10)
        self.card.pack(fill="x", pady=10)

        self.btn_browse = ctk.CTkButton(self.card, text="CHỌN FILE COOKIE (JSON)",
                                        fg_color="#38bdf8", text_color="#0f172a", hover_color="#0ea5e9",
                                        font=("Arial", 13, "bold"), height=40, command=self.select_file)
        self.btn_browse.pack(fill="x", padx=15, pady=15)

        self.lbl_path = ctk.CTkLabel(self.card, text="Chưa chọn file...", text_color="#94a3b8", font=("Consolas", 11), wraplength=350)
        self.lbl_path.pack(padx=15, pady=(0, 15))

        # Log
        self.log_box = ctk.CTkTextbox(self.main_frame, fg_color="#000000", text_color="#4ade80",
                                      font=("Consolas", 12), corner_radius=8)
        self.log_box.pack(fill="both", expand=True, pady=15)
        self.log_box.configure(state="disabled")

        # Start Button
        self.btn_run = ctk.CTkButton(self.main_frame, text="BẮT ĐẦU TỐI ƯU",
                                     fg_color="#22c55e", hover_color="#16a34a",
                                     height=50, font=("Arial", 16, "bold"), command=self.start_process)
        self.btn_run.pack(fill="x", pady=(5, 10))

    def select_file(self):
        path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
        if path:
            self.cookie_path.set(path)
            self.lbl_path.configure(text=f"📄 {os.path.basename(path)}")
            self.log(f"📂 Đã nạp: {os.path.basename(path)}")

    def log(self, msg):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"> {msg}\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def start_process(self):
        if not self.cookie_path.get():
            self.log("⚠️ Vui lòng chọn file trước!")
            return

        self.btn_run.configure(state="disabled", text="ĐANG XỬ LÝ...", fg_color="#475569")
        self.stop_event.clear()
        threading.Thread(target=self.worker, daemon=True).start()

    def worker(self):
        try:
            run_cookie_forge(self.cookie_path.get(), self.log, self.stop_event)
        except Exception as e:
            self.log(f"❌ Lỗi: {e}")
        finally:
            self.after(0, self.reset_ui)

    def reset_ui(self):
        self.btn_run.configure(state="normal", text="BẮT ĐẦU TỐI ƯU", fg_color="#22c55e")

if __name__ == "__main__":
    app = CookieForgeApp()
    app.mainloop()
