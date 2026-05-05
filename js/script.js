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
        this.dom.querySelector('.time-display').textContent = displayStr;
        
        const progress = ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100;
        this.dom.querySelector('.progress-bar').style.width = `${progress}%`;
    }

    toggle() {
        if (this.isRunning) this.pause();
        else this.start();
    }

    start() {
        if (this.isRunning || this.remainingSeconds <= 0) return;
        this.isRunning = true;
        this.dom.classList.add('active-timer');
        this.dom.querySelector('.play-icon').classList.add('hidden');
        this.dom.querySelector('.pause-icon').classList.remove('hidden');
        
        // Handle Start sounds immediately
        this.sounds.forEach(s => {
            if (s.audio) {
                if (s.type === 'loop') {
                    s.audio.loop = true;
                    s.audio.play().catch(console.warn);
                } else if (s.type === 'start' && s.time > 0) {
                    // Start sound plays from t=0
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
        this.dom.querySelector('.play-icon').classList.remove('hidden');
        this.dom.querySelector('.pause-icon').classList.add('hidden');
        
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
        // Stop all sounds on completion except final end triggers
        this.sounds.forEach(s => {
            if (s.audio && s.type !== 'end') {
                s.audio.pause();
                s.audio.currentTime = 0;
            }
        });
        this.checkSounds(this.totalSeconds, true);
    }

    checkSounds(elapsed, isEnd = false) {
        this.sounds.forEach(s => {
            if (s.type === 'loop') return;
            if (!s.audio) return;

            // Logika MULAI: Bunyi dari awal (t=0) sampai detik ke-X (elapsed == time)
            if (s.type === 'start') {
                if (elapsed >= s.time) {
                    s.audio.pause(); // Berhenti di detik ke-X
                    s.audio.currentTime = 0;
                }
            }

            // Logika SELESAI: Bunyi dari sisa detik ke-X sampai habis (t=total)
            if (s.type === 'end') {
                if (this.remainingSeconds === s.time) {
                    s.audio.currentTime = 0;
                    s.audio.play().catch(console.warn);
                }
                if (isEnd || this.remainingSeconds === 0) {
                    // Optional: loop behavior during the end countdown? 
                    // For now, it just starts at s.time.
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
        this.init();
    }

    init() {
        const list = document.querySelector('.timer-list');
        const mode = list.getAttribute('data-mode');
        
        list.innerHTML = '';
        this.timers.forEach(t => {
            const isMatch = (mode == t.id) || (mode && t.title.toLowerCase() === mode.toLowerCase());
            if (!mode || isMatch) {
                list.appendChild(t.dom);
            }
        });

        const addBtn = document.getElementById('add-new-timer-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addNewTimer());
        }

        const toggle = document.getElementById('auto-mode-toggle');
        if (toggle) {
            toggle.checked = this.isAutoMode;
            toggle.addEventListener('change', (e) => {
                this.isAutoMode = e.target.checked;
                localStorage.setItem('timerAutoMode', this.isAutoMode);
            });
        }

        if (localStorage.getItem('timerAutoStart') === 'true') {
            localStorage.removeItem('timerAutoStart');
            const timerToStart = mode ? (this.timers.find(t => t.id == mode) || this.timers[0]) : this.timers[0];
            if (timerToStart) setTimeout(() => timerToStart.start(), 1000);
        }

        document.getElementById('add-sound-btn').addEventListener('click', () => this.addSoundRow());
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfig());
    }

    addNewTimer() {
        const title = prompt('Masukkan Nama Pewaktu Baru:');
        if (!title) return;
        const minutes = parseInt(prompt('Masukkan Durasi (Menit):', '5')) || 5;
        
        const newId = this.timers.length + 1;
        const newTimer = new Timer(newId, title, minutes);
        this.timers.push(newTimer);
        
        const list = document.querySelector('.timer-list');
        if (!list.getAttribute('data-mode')) {
            list.appendChild(newTimer.dom);
        }
    }

    startNextTimer(currentId) {
        const nextId = currentId + 1;
        const list = document.querySelector('.timer-list');
        const isDashboard = !list.getAttribute('data-mode');

        if (isDashboard) {
            const nextTimer = this.timers.find(t => t.id === nextId);
            if (nextTimer) nextTimer.start();
            else alert('Seluruh rangkaian timer selesai!');
        } else {
            const pages = {
                1: 'lomba.html',
                2: 'evaluasi.html'
            };
            
            if (pages[currentId]) {
                localStorage.setItem('timerAutoStart', 'true');
                window.location.href = pages[currentId];
            } else {
                alert('Seluruh rangkaian timer selesai!');
            }
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
        
        if (timer.sounds.length === 0) {
            this.addSoundRow();
        } else {
            timer.sounds.forEach(sound => this.addSoundRow(sound));
        }

        document.querySelector('.config-panel').classList.remove('hidden');
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
                    <button class="btn-play-preview" title="Test Suara" style="background:none; border:none; color:var(--success); cursor:pointer;">
                        <i class="fas fa-play-circle"></i>
                    </button>
                    <button class="btn-remove-sound" title="Hapus Suara" style="background:none; border:none; color:var(--danger); cursor:pointer;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            <div class="sound-inputs">
                <div class="input-group">
                    <label style="font-size:0.7rem">Pilih File</label>
                    <select class="snd-file">
                        <option value="">-- Pilih --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="input-group">
                    <label style="font-size:0.7rem">Tipe Trigger</label>
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

        const typeSelect = div.querySelector('.snd-type');
        const timeInput = div.querySelector('.snd-time');
        const previewBtn = div.querySelector('.btn-play-preview');
        
        typeSelect.addEventListener('change', () => {
            timeInput.disabled = (typeSelect.value === 'loop');
            if (typeSelect.value === 'loop') timeInput.value = 0;
        });

        previewBtn.addEventListener('click', () => {
            const filename = div.querySelector('.snd-file').value;
            if (filename) {
                const audio = new Audio(`assets/${filename}`);
                audio.play().catch(() => alert('File tidak ditemukan di assets/'));
            } else {
                alert('Pilih file dulu untuk mengetes!');
            }
        });

        div.querySelector('.btn-remove-sound').addEventListener('click', () => {
            if (document.querySelectorAll('.sound-item').length > 1) {
                div.remove();
            } else {
                div.querySelector('.snd-file').value = '';
                div.querySelector('.snd-type').value = 'start';
                div.querySelector('.snd-time').value = 0;
            }
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
        const rows = document.querySelectorAll('.sound-item');
        rows.forEach(row => {
            const filename = row.querySelector('.snd-file').value;
            const type = row.querySelector('.snd-type').value;
            const time = parseInt(row.querySelector('.snd-time').value) || 0;
            
            if (filename) {
                const audio = new Audio(`assets/${filename}`);
                timer.sounds.push({ filename, type, time, audio, played: false });
            }
        });

        alert(`${timer.sounds.length} Suara berhasil disimpan untuk timer ${timer.title}!`);
    }
}

const app = new App();
