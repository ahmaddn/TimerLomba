class Timer {
  constructor(id, title, defaultMinutes) {
    this.id = id;
    this.title = title;
    this.defaultSeconds = defaultMinutes * 60;
    this.remainingSeconds = this.defaultSeconds;
    this.totalSeconds = this.defaultSeconds;

    this.isRunning = false;
    this.interval = null;
    this.sounds = []; // Array of { filename, type, time, audio, played }

    this.dom = this.createDOM();
    this.updateDisplay();
  }

  createDOM() {
    const div = document.createElement("div");
    div.className = "timer-card";
    div.id = `timer-${this.id}`;
    div.innerHTML = `
            <div class="timer-info">
                <h2>${this.title}</h2>
                <div class="time-display-wrapper">
                    <div class="time-display">00:00:00</div>
                    <div class="progress-section">
                        <div class="progress-bar-container">
                            <div class="progress-bar"></div>
                        </div>
                        <span class="progress-percentage">0%</span>
                    </div>
                </div>
            </div>
            <div class="timer-actions">
                <button class="btn-circle delete-btn btn-delete-timer" title="Hapus Timer">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button class="btn-circle reset-btn" title="Reset Waktu">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="btn-circle settings-btn" title="Pengaturan Suara & Durasi">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn-circle play-btn" title="Mulai/Jeda">
                    <i class="fas fa-play play-icon"></i>
                    <i class="fas fa-pause pause-icon hidden"></i>
                </button>
            </div>
        `;

    div
      .querySelector(".delete-btn")
      .addEventListener("click", () => app.openDeleteModal(this));
    div.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        app.selectTimer(this);
      }
    });

    div.querySelector(".reset-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.reset();
    });
    div.querySelector(".settings-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      app.openSettings(this);
    });
    div.querySelector(".play-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    return div;
  }

  updateDisplay() {
    const h = Math.floor(this.remainingSeconds / 3600);
    const m = Math.floor((this.remainingSeconds % 3600) / 60);
    const s = this.remainingSeconds % 60;
    const displayStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

    // Update DOM if it exists in the current view
    const display = this.dom.querySelector(".time-display");
    if (display) display.textContent = displayStr;

    const bar = this.dom.querySelector(".progress-bar");
    const perc = this.dom.querySelector(".progress-percentage");
    if (bar) {
      const progress =
        ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100;
      bar.style.width = `${progress}%`;
      if (perc) perc.textContent = `${Math.round(progress)}%`;
    }

    // Sync with Dashboard Right Panel if this is the selected timer
    if (
      window.app &&
      window.app.selectedTimer === this &&
      window.app.currentView === "dashboard"
    ) {
      window.app.updateRightPanelDisplay();
    }
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  start() {
    if (this.isRunning || this.remainingSeconds <= 0) return;
    this.isRunning = true;
    this.dom.classList.add("active-timer");
    this.dom.querySelector(".play-icon")?.classList.add("hidden");
    this.dom.querySelector(".pause-icon")?.classList.remove("hidden");

    this.sounds.forEach((s) => {
      if (s.audio) {
        if (s.type === "loop") {
          s.audio.loop = true;
          s.audio.play().catch(console.warn);
        } else if (s.type === "start" && s.time > 0) {
          s.audio.currentTime = 0;
          s.audio.play().catch(console.warn);
        }
      }
    });

    this.interval = setInterval(() => {
      const elapsed = this.totalSeconds - this.remainingSeconds;
      this.remainingSeconds--;
      this.updateDisplay();
      this.checkSounds(elapsed + 1);

      if (this.remainingSeconds <= 0) {
        this.complete();
      }
    }, 1000);
  }

  pause() {
    this.isRunning = false;
    clearInterval(this.interval);
    this.dom.classList.remove("active-timer");
    this.dom.querySelector(".play-icon")?.classList.remove("hidden");
    this.dom.querySelector(".pause-icon")?.classList.add("hidden");

    this.sounds.forEach((s) => {
      if (s.audio) s.audio.pause();
    });
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    this.dom.classList.remove("warning-pulse");
    this.updateDisplay();
    this.sounds.forEach((s) => {
      s.played = false;
      if (s.audio) {
        s.audio.pause();
        s.audio.currentTime = 0;
      }
    });
  }

  complete() {
    this.pause();
    this.dom.classList.remove("warning-pulse");
    this.sounds.forEach((s) => {
      if (s.audio && s.type !== "end") {
        s.audio.pause();
        s.audio.currentTime = 0;
      }
    });
    this.checkSounds(this.totalSeconds, true);

    if (app.isAutoMode) {
      app.startNextTimer(this.id);
    }
  }

  checkSounds(elapsed, isEnd = false) {
    this.sounds.forEach((s) => {
      if (s.type === "loop") return;
      if (!s.audio) return;

      if (s.type === "start") {
        if (elapsed >= s.time) {
          s.audio.pause();
          s.audio.currentTime = 0;
        }
      }

      if (s.type === "end") {
        if (this.remainingSeconds === s.time) {
          s.audio.currentTime = 0;
          s.audio.play().catch(console.warn);
          this.dom.classList.add("warning-pulse");
        }
      }
    });
  }
}

class App {
  constructor() {
    window.app = this;
    this.timers = [
      new Timer(1, "Persiapan", 5),
      new Timer(2, "Waktu Lomba", 45),
      new Timer(3, "Evaluasi Peserta dan Persiapan Unit", 10),
    ];
    this.availableAssets = [
      "Announcement.mpeg",
      "Nuclear Alarm.mov",
      "War Siren.mpeg",
      "Social Credit Alert.mp3",
    ];
    this.customAssets = [];
    this.initDatabase().then(() => this.fetchAssets());

    this.timerToDelete = null;
    this.isAutoMode = localStorage.getItem("timerAutoMode") === "true";
    this.currentView = "";
    this.selectedTimer = null;

    window.addEventListener("hashchange", () => this.handleRouting());
    this.init();
  }

  init() {
    // Clean URL: Remove index.html if present
    if (location.pathname.endsWith("index.html")) {
      const cleanPath = location.pathname.replace("index.html", "");
      window.history.replaceState(null, "", cleanPath + location.hash);
    }

    // Auto Mode Toggle Sync
    const toggle = document.getElementById("auto-mode-toggle");
    if (toggle) {
      toggle.checked = this.isAutoMode;
      toggle.addEventListener("change", (e) => {
        this.isAutoMode = e.target.checked;
        localStorage.setItem("timerAutoMode", this.isAutoMode);
      });
    }

    // Config buttons
    document
      .getElementById("add-sound-btn")
      .addEventListener("click", () => this.addSoundRow());
    document
      .getElementById("save-config-btn")
      .addEventListener("click", () => this.saveConfig());

    // Modal buttons
    document
      .getElementById("confirm-add-timer")
      .addEventListener("click", () => this.addNewTimer());
    document
      .getElementById("confirm-delete-timer")
      .addEventListener("click", () => this.deleteTimer());
    document
      .getElementById("confirm-quick-edit")
      .addEventListener("click", () => this.saveQuickEdit());

    // Upload feature listeners
    document
      .getElementById("upload-sound-trigger")
      .addEventListener("click", () => this.openModal("upload-sound"));

    const dropZone = document.getElementById("upload-drop-zone");
    const fileInput = document.getElementById("sound-file-input");

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () =>
      dropZone.classList.remove("dragover"),
    );
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length) {
        this.handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length) {
        this.handleFileSelection(e.target.files[0]);
      }
    });

    document
      .getElementById("confirm-upload-btn")
      .addEventListener("click", () => this.saveUploadedFile());

    // Initial Routing
    if (!location.hash) location.hash = "#home";
    else this.handleRouting();
  }

  handleRouting() {
    const hash = location.hash.replace("#", "") || "home";
    this.renderView(hash);

    // Update tab active state
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    const activeTab =
      document.getElementById(`tab-${hash}`) ||
      document.getElementById(`tab-focused`);
    if (activeTab) activeTab.classList.add("active");

    // Close config panel on route change
    this.closeSettings();
    this.currentView = hash;
  }

  renderView(viewName) {
    const container = document.getElementById("view-container");
    const header = document.querySelector(".app-header");
    const headerToggle = document.getElementById("global-auto-toggle-wrapper");

    // Toggle Header visibility: Hidden on Home, Visible elsewhere
    if (viewName === "home") {
      header.classList.add("hidden");
      document.body.classList.add("home-active");
    } else {
      header.classList.remove("hidden");
      document.body.classList.remove("home-active");
    }

    // Hide/Show Auto Toggle based on view
    if (viewName === "home" || viewName === "petunjuk")
      headerToggle.style.visibility = "hidden";
    else headerToggle.style.visibility = "visible";

    if (viewName === "home") {
      container.innerHTML = document.getElementById("template-home").innerHTML;
    } else if (viewName === "petunjuk") {
      container.innerHTML =
        document.getElementById("template-petunjuk").innerHTML;
    } else if (viewName === "dashboard") {
      container.innerHTML =
        document.getElementById("template-dashboard").innerHTML;
      const list = document.getElementById("dashboard-timer-list");
      this.timers.forEach((t) => list.appendChild(t.dom));

      // Set initial selected timer
      if (!this.selectedTimer) this.selectedTimer = this.timers[0];
      this.selectTimer(this.selectedTimer);

      // Setup Dashboard Right Panel logic
      document
        .getElementById("panel-add-timer-btn")
        .addEventListener("click", () => this.openModal("add-timer"));

      const startBtn = document.getElementById("picker-start-btn");
      startBtn.addEventListener("click", () => {
        if (this.selectedTimer) {
          this.selectedTimer.toggle();
        }
      });

      // Make picker digits clickable
      ["h", "m", "s"].forEach((unit) => {
        const el = document.getElementById(`picker-${unit}`);
        el.addEventListener("click", () => {
          if (!this.selectedTimer) return;
          this.openQuickEdit();
        });
      });
    } else {
      // Focused views (persiapan, lomba, evaluasi)
      container.innerHTML =
        document.getElementById("template-focused").innerHTML;
      const list = document.getElementById("focused-timer-list");

      const mapping = { persiapan: 1, lomba: 2, evaluasi: 3 };
      const targetId = mapping[viewName];

      if (targetId) {
        const timer = this.timers.find((t) => t.id === targetId);
        if (timer) {
          list.appendChild(timer.dom);
          // Check for auto-start
          if (localStorage.getItem("timerAutoStart") === "true") {
            localStorage.removeItem("timerAutoStart");
            setTimeout(() => timer.start(), 1000);
          }
        }
      } else {
        // Handle dynamic timers from dashboard if focused
        const timer = this.timers.find(
          (t) => t.title.toLowerCase().replace(/\s+/g, "-") === viewName,
        );
        if (timer) list.appendChild(timer.dom);
      }
    }
    this.currentView = viewName;
  }

  openModal(modalId) {
    document.getElementById(`modal-${modalId}`).classList.add("show");
  }

  closeModal(modalId) {
    document.getElementById(`modal-${modalId}`).classList.remove("show");
  }

  addNewTimer() {
    const titleInput = document.getElementById("add-timer-name");
    const durationInput = document.getElementById("add-timer-duration");

    const title = titleInput.value.trim();
    const minutes = parseInt(durationInput.value) || 5;
    const errorMsg = document.getElementById("add-timer-error");

    if (!title) {
      errorMsg.style.display = "block";
      return;
    }

    errorMsg.style.display = "none";

    const newId =
      this.timers.length > 0
        ? Math.max(...this.timers.map((t) => t.id)) + 1
        : 1;
    const newTimer = new Timer(newId, title, minutes);
    this.timers.push(newTimer);

    if (this.currentView === "dashboard") {
      const list = document.getElementById("dashboard-timer-list");
      const addBtnContainer = document.querySelector(".add-timer-container");
      list.insertBefore(newTimer.dom, addBtnContainer);
    }

    // Reset and Close
    titleInput.value = "";
    durationInput.value = "5";
    this.closeModal("add-timer");
  }

  openDeleteModal(timer) {
    this.timerToDelete = timer;
    this.openModal("delete-confirm");
  }

  deleteTimer() {
    if (!this.timerToDelete) return;

    const index = this.timers.indexOf(this.timerToDelete);
    if (index > -1) {
      this.timerToDelete.pause();
      this.timers.splice(index, 1);
      this.timerToDelete.dom.remove();
    }

    this.timerToDelete = null;
    this.closeModal("delete-confirm");
  }

  startNextTimer(currentId) {
    const currentIndex = this.timers.findIndex((t) => t.id === currentId);
    const nextTimer = this.timers[currentIndex + 1];

    if (!nextTimer) {
      return; // No more timers
    }

    const viewMapping = { 1: "persiapan", 2: "lomba", 3: "evaluasi" };
    const nextView = viewMapping[nextTimer.id] || "dashboard";

    if (this.currentView === "dashboard") {
      this.selectTimer(nextTimer);
      nextTimer.start();
    } else {
      localStorage.setItem("timerAutoStart", "true");
      location.hash = `#${nextView}`;
    }
  }

  openSettings(timer) {
    this.activeTimerForConfig = timer;
    document.getElementById("config-title").textContent =
      `Pengaturan: ${timer.title}`;

    const h = Math.floor(timer.totalSeconds / 3600);
    const m = Math.floor((timer.totalSeconds % 3600) / 60);
    const s = timer.totalSeconds % 60;
    document.getElementById("cfg-hours").value = h;
    document.getElementById("cfg-mins").value = m;
    document.getElementById("cfg-secs").value = s;

    const soundList = document.getElementById("sound-list");
    soundList.innerHTML = "";

    if (timer.sounds.length === 0) this.addSoundRow();
    else timer.sounds.forEach((sound) => this.addSoundRow(sound));

    this.openModal("settings");
  }

  closeSettings() {
    this.closeModal("settings");
  }

  addSoundRow(data = null) {
    const container = document.getElementById("sound-list");
    const div = document.createElement("div");
    div.className = "sound-item";

    const allAssets = [
      ...this.availableAssets,
      ...this.customAssets.map((a) => a.name),
    ];

    const optionsHtml = allAssets
      .map((file) => {
        const isCustom = this.customAssets.find((ca) => ca.name === file);
        return `<option value="${file}" ${data && data.filename === file ? "selected" : ""}>${file} ${isCustom ? "(Uploaded)" : ""}</option>`;
      })
      .join("");

    div.innerHTML = `
            <div class="sound-item-header">
                <span style="font-size:0.75rem; font-weight:800; color:var(--accent)">
                    <i class="fas fa-volume-up"></i> SLOT SUARA
                </span>
                <div style="display:flex; gap: 0.5rem;">
                    <button class="btn-preview-sound" title="Test Suara" style="background:none; border:none; color:var(--success); cursor:pointer;">
                        <i class="fas fa-play-circle"></i>
                    </button>
                    <button class="btn-remove-sound" title="Hapus" style="background:none; border:none; color:var(--danger); cursor:pointer;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            <div class="sound-inputs">
                <div class="input-group">
                    <label style="font-size:0.7rem">File</label>
                    <select class="snd-file" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border-color);">
                        <option value="">-- Pilih --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="input-group">
                    <label style="font-size:0.7rem">Tipe</label>
                    <select class="snd-type" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border-color);">
                        <option value="start" ${data?.type === "start" ? "selected" : ""}>Mulai</option>
                        <option value="end" ${data?.type === "end" ? "selected" : ""}>Selesai</option>
                        <option value="loop" ${data?.type === "loop" ? "selected" : ""}>Berputar</option>
                    </select>
                </div>
                <div class="input-group">
                    <label style="font-size:0.7rem">Detik</label>
                    <input type="number" class="snd-time" min="0" value="${data ? data.time : 0}" ${data?.type === "loop" ? "disabled" : ""} style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid var(--border-color);">
                </div>
            </div>
        `;

    div.querySelector(".snd-type").addEventListener("change", (e) => {
      div.querySelector(".snd-time").disabled = e.target.value === "loop";
    });

    div.querySelector(".btn-preview-sound").addEventListener("click", () => {
      const file = div.querySelector(".snd-file").value;
      if (file) {
        const custom = this.customAssets.find((a) => a.name === file);
        const url = custom ? custom.url : `assets/${file}`;
        new Audio(url).play().catch(console.warn);
      }
    });

    div.querySelector(".btn-remove-sound").addEventListener("click", () => {
      if (document.querySelectorAll(".sound-item").length > 1) div.remove();
    });

    container.appendChild(div);
  }

  saveConfig() {
    const timer = this.activeTimerForConfig;
    if (!timer) return;

    const h = parseInt(document.getElementById("cfg-hours").value) || 0;
    const m = parseInt(document.getElementById("cfg-mins").value) || 0;
    const s = parseInt(document.getElementById("cfg-secs").value) || 0;
    timer.totalSeconds = h * 3600 + m * 60 + s;
    timer.remainingSeconds = timer.totalSeconds;
    timer.updateDisplay();

    timer.sounds = [];
    document.querySelectorAll(".sound-item").forEach((row) => {
      const filename = row.querySelector(".snd-file").value;
      const type = row.querySelector(".snd-type").value;
      const time = parseInt(row.querySelector(".snd-time").value) || 0;
      if (filename) {
        const custom = this.customAssets.find((a) => a.name === filename);
        const url = custom ? custom.url : `assets/${filename}`;
        timer.sounds.push({
          filename,
          type,
          time,
          audio: new Audio(url),
          played: false,
        });
      }
    });

    this.closeSettings();
  }
  selectTimer(timer) {
    this.selectedTimer = timer;

    // Highlight selected card
    document.querySelectorAll(".timer-card").forEach((card) => {
      card.classList.remove("selected-card");
    });
    timer.dom.classList.add("selected-card");

    // Update panel title
    const titleEl = document.getElementById("selected-timer-info");
    if (titleEl) titleEl.textContent = timer.title;

    this.updateRightPanelDisplay();
  }

  updateRightPanelDisplay() {
    if (!this.selectedTimer) return;

    const h = Math.floor(this.selectedTimer.remainingSeconds / 3600);
    const m = Math.floor((this.selectedTimer.remainingSeconds % 3600) / 60);
    const s = this.selectedTimer.remainingSeconds % 60;

    const hEl = document.getElementById("picker-h");
    const mEl = document.getElementById("picker-m");
    const sEl = document.getElementById("picker-s");
    const startBtn = document.getElementById("picker-start-btn");

    if (hEl) hEl.textContent = h.toString().padStart(2, "0");
    if (mEl) mEl.textContent = m.toString().padStart(2, "0");
    if (sEl) sEl.textContent = s.toString().padStart(2, "0");

    if (startBtn) {
      if (this.selectedTimer.isRunning) {
        startBtn.innerHTML = '<i class="fas fa-pause"></i> Jeda';
        startBtn.classList.add("btn-danger");
      } else {
        startBtn.innerHTML = '<i class="fas fa-play"></i> Mulai';
        startBtn.classList.remove("btn-danger");
      }
    }
  }

  openQuickEdit() {
    if (!this.selectedTimer) return;
    const t = this.selectedTimer;
    const h = Math.floor(t.remainingSeconds / 3600);
    const m = Math.floor((t.remainingSeconds % 3600) / 60);
    const s = t.remainingSeconds % 60;

    document.getElementById("quick-cfg-hours").value = h;
    document.getElementById("quick-cfg-mins").value = m;
    document.getElementById("quick-cfg-secs").value = s;

    this.openModal("quick-edit");
  }

  saveQuickEdit() {
    if (!this.selectedTimer) return;
    const h = parseInt(document.getElementById("quick-cfg-hours").value) || 0;
    const m = parseInt(document.getElementById("quick-cfg-mins").value) || 0;
    const s = parseInt(document.getElementById("quick-cfg-secs").value) || 0;

    const totalSecs = h * 3600 + m * 60 + s;
    if (totalSecs <= 0) {
      alert("Durasi harus lebih dari 0!");
      return;
    }

    this.selectedTimer.totalSeconds = totalSecs;
    this.selectedTimer.remainingSeconds = totalSecs;
    this.selectedTimer.updateDisplay();
    this.closeModal("quick-edit");
  }

  handleFileSelection(file) {
    this.selectedUploadFile = file;
    const info = document.getElementById("upload-file-info");
    const nameSpan = document.getElementById("selected-file-name");
    const confirmBtn = document.getElementById("confirm-upload-btn");

    nameSpan.textContent = file.name;
    info.classList.remove("hidden");
    confirmBtn.disabled = false;
  }

  async saveUploadedFile() {
    if (!this.selectedUploadFile) return;

    const file = this.selectedUploadFile;
    const confirmBtn = document.getElementById("confirm-upload-btn");
    confirmBtn.disabled = true;

    try {
      // Save to IndexedDB
      await this.saveToDB(file);

      // Refresh assets list
      await this.fetchAssets();

      alert(
        `Berhasil! File "${file.name}" kini tersimpan secara permanen di browser ini.`,
      );
    } catch (error) {
      console.error("Database storage failed:", error);
      alert("Gagal menyimpan file ke database lokal.");
    } finally {
      confirmBtn.disabled = false;
    }

    // Refresh current settings if open
    if (this.activeTimerForConfig) {
      this.openSettings(this.activeTimerForConfig);
    }

    this.closeModal("upload-sound");

    // Reset upload modal
    document.getElementById("upload-file-info").classList.add("hidden");
    document.getElementById("confirm-upload-btn").disabled = true;
    this.selectedUploadFile = null;
  }

  // --- IndexedDB Management ---

  initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("TimerLombaDB", 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("sounds")) {
          db.createObjectStore("sounds", { keyPath: "name" });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  saveToDB(file) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["sounds"], "readwrite");
      const store = transaction.objectStore("sounds");
      const request = store.put({ name: file.name, data: file });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async fetchAssets() {
    return new Promise((resolve) => {
      const transaction = this.db.transaction(["sounds"], "readonly");
      const store = transaction.objectStore("sounds");
      const request = store.getAll();

      request.onsuccess = () => {
        const dbSounds = request.result;
        this.customAssets = dbSounds.map((s) => ({
          name: s.name,
          url: URL.createObjectURL(s.data),
        }));
        resolve();
      };

      request.onerror = () => {
        console.warn("Could not read from IndexedDB");
        resolve();
      };
    });
  }
}

const app = new App();
