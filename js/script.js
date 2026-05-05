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
        const div = document.createElement('div');
        div.className = 'timer-card';
        div.id = `timer-${this.id}`;
        div.innerHTML = `
            <div class="timer-info">
                <h2>${this.title}</h2>
                <div class="time-display">00:00:00</div>
            </div>
            <div class="timer-actions">
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
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
        `;
        
        div.querySelector('.reset-btn').addEventListener('click', () => this.reset());
        div.querySelector('.settings-btn').addEventListener('click', () => app.openSettings(this));
        div.querySelector('.play-btn').addEventListener('click', () => this.toggle());
        
        return div;
    }

    updateDisplay() {
        const h = Math.floor(this.remainingSeconds / 3600);
        const m = Math.floor((this.remainingSeconds % 3600) / 60);
        const s = this.remainingSeconds % 60;
        const displayStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        // Update DOM if it exists in the current view
        const display = this.dom.querySelector('.time-display');
        if (display) display.textContent = displayStr;
        
        const bar = this.dom.querySelector('.progress-bar');
        if (bar) {
            const progress = ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100;
            bar.style.width = `${progress}%`;
        }
    }

    toggle() {
        if (this.isRunning) this.pause();
        else this.start();
    }

    start() {
        if (this.isRunning || this.remainingSeconds <= 0) return;
        this.isRunning = true;
        this.dom.classList.add('active-timer');
        this.dom.querySelector('.play-icon')?.classList.add('hidden');
        this.dom.querySelector('.pause-icon')?.classList.remove('hidden');
        
        this.sounds.forEach(s => {
            if (s.audio) {
                if (s.type === 'loop') {
                    s.audio.loop = true;
                    s.audio.play().catch(console.warn);
                } else if (s.type === 'start' && s.time > 0) {
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
        this.dom.classList.remove('active-timer');
        this.dom.querySelector('.play-icon')?.classList.remove('hidden');
        this.dom.querySelector('.pause-icon')?.classList.add('hidden');
        
        this.sounds.forEach(s => {
            if (s.audio) s.audio.pause();
        });
    }

    reset() {
        this.pause();
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        this.sounds.forEach(s => {
            s.played = false;
            if (s.audio) {
                s.audio.pause();
                s.audio.currentTime = 0;
            }
        });
    }

    complete() {
        this.pause();
        this.sounds.forEach(s => {
            if (s.audio && s.type !== 'end') {
                s.audio.pause();
                s.audio.currentTime = 0;
            }
        });
        this.checkSounds(this.totalSeconds, true);
        
        if (app.isAutoMode) {
            setTimeout(() => {
                app.startNextTimer(this.id);
            }, 1500);
        }
    }

    checkSounds(elapsed, isEnd = false) {
        this.sounds.forEach(s => {
            if (s.type === 'loop') return;
            if (!s.audio) return;

            if (s.type === 'start') {
                if (elapsed >= s.time) {
                    s.audio.pause();
                    s.audio.currentTime = 0;
                }
            }

            if (s.type === 'end') {
                if (this.remainingSeconds === s.time) {
                    s.audio.currentTime = 0;
                    s.audio.play().catch(console.warn);
                }
            }
        });
    }
}

class App {
    constructor() {
        this.timers = [
            new Timer(1, 'Persiapan', 5),
            new Timer(2, 'Waktu Lomba', 45),
            new Timer(3, 'Evaluasi Peserta dan Persiapan Unit', 10)
        ];
        this.availableAssets = [
            'Announcement.mpeg',
            'Nuclear Alarm.mov',
            'War Siren.mpeg'
        ];
        this.activeTimerForConfig = null;
        this.isAutoMode = localStorage.getItem('timerAutoMode') === 'true';
        this.currentView = '';
        
        window.addEventListener('hashchange', () => this.handleRouting());
        this.init();
    }

    init() {
        // Clean URL: Remove index.html if present
        if (location.pathname.endsWith('index.html')) {
            const cleanPath = location.pathname.replace('index.html', '');
            window.history.replaceState(null, '', cleanPath + location.hash);
        }

        // Auto Mode Toggle Sync
        const toggle = document.getElementById('auto-mode-toggle');
        if (toggle) {
            toggle.checked = this.isAutoMode;
            toggle.addEventListener('change', (e) => {
                this.isAutoMode = e.target.checked;
                localStorage.setItem('timerAutoMode', this.isAutoMode);
            });
        }

        // Config buttons
        document.getElementById('add-sound-btn').addEventListener('click', () => this.addSoundRow());
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfig());

        // Initial Routing
        if (!location.hash) location.hash = '#home';
        else this.handleRouting();
    }

    handleRouting() {
        const hash = location.hash.replace('#', '') || 'home';
        this.renderView(hash);
        
        // Update tab active state
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.getElementById(`tab-${hash}`) || document.getElementById(`tab-focused`);
        if (activeTab) activeTab.classList.add('active');

        // Close config panel on route change
        this.closeSettings();
    }

    renderView(viewName) {
        const container = document.getElementById('view-container');
        const header = document.querySelector('.app-header');
        const headerToggle = document.getElementById('global-auto-toggle-wrapper');
        
        // Toggle Header visibility: Hidden on Home, Visible elsewhere
        if (viewName === 'home') header.classList.add('hidden');
        else header.classList.remove('hidden');

        // Hide/Show Auto Toggle based on view
        if (viewName === 'home' || viewName === 'petunjuk') headerToggle.style.visibility = 'hidden';
        else headerToggle.style.visibility = 'visible';

        if (viewName === 'home') {
            container.innerHTML = document.getElementById('template-home').innerHTML;
        } 
        else if (viewName === 'petunjuk') {
            container.innerHTML = document.getElementById('template-petunjuk').innerHTML;
        }
        else if (viewName === 'dashboard') {
            container.innerHTML = document.getElementById('template-dashboard').innerHTML;
            const list = document.getElementById('dashboard-timer-list');
            this.timers.forEach(t => list.insertBefore(t.dom, document.getElementById('add-new-timer-btn')));
            document.getElementById('add-new-timer-btn').addEventListener('click', () => this.addNewTimer());
        }
        else {
            // Focused views (persiapan, lomba, evaluasi)
            container.innerHTML = document.getElementById('template-focused').innerHTML;
            const list = document.getElementById('focused-timer-list');
            
            const mapping = { 'persiapan': 1, 'lomba': 2, 'evaluasi': 3 };
            const targetId = mapping[viewName];
            
            if (targetId) {
                const timer = this.timers.find(t => t.id === targetId);
                if (timer) {
                    list.appendChild(timer.dom);
                    // Check for auto-start
                    if (localStorage.getItem('timerAutoStart') === 'true') {
                        localStorage.removeItem('timerAutoStart');
                        setTimeout(() => timer.start(), 1000);
                    }
                }
            } else {
                // Handle dynamic timers from dashboard if focused
                const timer = this.timers.find(t => t.title.toLowerCase().replace(/\s+/g, '-') === viewName);
                if (timer) list.appendChild(timer.dom);
            }
        }
        this.currentView = viewName;
    }

    addNewTimer() {
        const title = prompt('Masukkan Nama Pewaktu Baru:');
        if (!title) return;
        const minutes = parseInt(prompt('Masukkan Durasi (Menit):', '5')) || 5;
        
        const newId = this.timers.length + 1;
        const newTimer = new Timer(newId, title, minutes);
        this.timers.push(newTimer);
        
        if (this.currentView === 'dashboard') {
            const list = document.getElementById('dashboard-timer-list');
            list.insertBefore(newTimer.dom, document.getElementById('add-new-timer-btn'));
        }
    }

    startNextTimer(currentId) {
        const nextId = currentId + 1;
        const nextTimer = this.timers.find(t => t.id === nextId);
        
        if (!nextTimer) {
            alert('Seluruh rangkaian timer selesai!');
            return;
        }

        const viewMapping = { 1: 'persiapan', 2: 'lomba', 3: 'evaluasi' };
        const nextView = viewMapping[nextId] || 'dashboard';

        if (this.currentView === 'dashboard') {
            nextTimer.start();
        } else {
            localStorage.setItem('timerAutoStart', 'true');
            location.hash = `#${nextView}`;
        }
    }

    openSettings(timer) {
        this.activeTimerForConfig = timer;
        document.getElementById('config-title').textContent = `Pengaturan: ${timer.title}`;
        
        const h = Math.floor(timer.totalSeconds / 3600);
        const m = Math.floor((timer.totalSeconds % 3600) / 60);
        const s = timer.totalSeconds % 60;
        document.getElementById('cfg-hours').value = h;
        document.getElementById('cfg-mins').value = m;
        document.getElementById('cfg-secs').value = s;

        const soundList = document.getElementById('sound-list');
        soundList.innerHTML = '';
        
        if (timer.sounds.length === 0) this.addSoundRow();
        else timer.sounds.forEach(sound => this.addSoundRow(sound));

        document.getElementById('main-config-panel').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('main-config-panel').classList.add('hidden');
    }

    addSoundRow(data = null) {
        const container = document.getElementById('sound-list');
        const div = document.createElement('div');
        div.className = 'sound-item';
        
        const optionsHtml = this.availableAssets.map(file => 
            `<option value="${file}" ${data && data.filename === file ? 'selected' : ''}>${file}</option>`
        ).join('');
        
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
                    <select class="snd-file">
                        <option value="">-- Pilih --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="input-group">
                    <label style="font-size:0.7rem">Tipe</label>
                    <select class="snd-type">
                        <option value="start" ${data?.type === 'start' ? 'selected' : ''}>Mulai</option>
                        <option value="end" ${data?.type === 'end' ? 'selected' : ''}>Selesai</option>
                        <option value="loop" ${data?.type === 'loop' ? 'selected' : ''}>Berputar</option>
                    </select>
                </div>
                <div class="input-group small">
                    <label style="font-size:0.7rem">Detik</label>
                    <input type="number" class="snd-time" min="0" value="${data ? data.time : 0}" ${data?.type === 'loop' ? 'disabled' : ''}>
                </div>
            </div>
        `;

        div.querySelector('.snd-type').addEventListener('change', (e) => {
            div.querySelector('.snd-time').disabled = (e.target.value === 'loop');
        });

        div.querySelector('.btn-preview-sound').addEventListener('click', () => {
            const file = div.querySelector('.snd-file').value;
            if (file) new Audio(`assets/${file}`).play().catch(console.warn);
        });

        div.querySelector('.btn-remove-sound').addEventListener('click', () => {
            if (document.querySelectorAll('.sound-item').length > 1) div.remove();
        });
        
        container.appendChild(div);
    }

    saveConfig() {
        const timer = this.activeTimerForConfig;
        if (!timer) return;

        const h = parseInt(document.getElementById('cfg-hours').value) || 0;
        const m = parseInt(document.getElementById('cfg-mins').value) || 0;
        const s = parseInt(document.getElementById('cfg-secs').value) || 0;
        timer.totalSeconds = (h * 3600) + (m * 60) + s;
        timer.remainingSeconds = timer.totalSeconds;
        timer.updateDisplay();

        timer.sounds = [];
        document.querySelectorAll('.sound-item').forEach(row => {
            const filename = row.querySelector('.snd-file').value;
            const type = row.querySelector('.snd-type').value;
            const time = parseInt(row.querySelector('.snd-time').value) || 0;
            if (filename) {
                timer.sounds.push({ filename, type, time, audio: new Audio(`assets/${filename}`), played: false });
            }
        });

        alert(`Pengaturan timer ${timer.title} berhasil disimpan!`);
        this.closeSettings();
    }
}

const app = new App();
