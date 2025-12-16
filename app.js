/* ============================================
   Moment - Meditation Timer PWA
   Inspired by am/fm by Adam Ludwin
   ============================================ */

// ============================================
// Configuration - Easily customizable audio sources
// ============================================

const CONFIG = {
    // Audio channels - Replace with your own audio sources
    channels: [
        { id: 0, name: 'Silence', src: null },
        { id: 1, name: 'Rain', src: null, type: 'generated', frequency: 'noise' },
        { id: 2, name: 'Waves', src: null, type: 'generated', frequency: 'waves' },
        { id: 3, name: 'Drone', src: null, type: 'generated', frequency: 220 },
    ],

    // Bell sounds - generated via Web Audio API
    bells: [
        { id: 0, name: 'Singing Bowl', frequency: 528, decay: 4 },
        { id: 1, name: 'Temple Bell', frequency: 440, decay: 3 },
        { id: 2, name: 'Chime', frequency: 880, decay: 2 },
        { id: 3, name: 'Deep Gong', frequency: 220, decay: 5 },
        { id: 4, name: 'Crystal', frequency: 1046, decay: 3 },
    ],

    // Timer presets in seconds
    presets: [300, 600, 900, 1200, 1800],

    // Default settings
    defaults: {
        duration: 900, // 15 minutes
        bellId: 0,
        channelId: 0,
        bellVolume: 0.8,
        ambientVolume: 0.5,
        theme: 'dark',
    }
};

// ============================================
// State Management
// ============================================

const state = {
    timer: {
        duration: CONFIG.defaults.duration,
        remaining: CONFIG.defaults.duration,
        isRunning: false,
        isPaused: false, // Track if we're in a paused session
        intervalId: null,
    },
    audio: {
        currentChannel: CONFIG.defaults.channelId,
        isPlaying: false,
        audioContext: null,
        currentSource: null,
        gainNode: null,
    },
    settings: {
        bellId: CONFIG.defaults.bellId,
        bellVolume: CONFIG.defaults.bellVolume,
        ambientVolume: CONFIG.defaults.ambientVolume,
        theme: CONFIG.defaults.theme,
    },
    session: {
        active: false, // True once a session has started (intention captured)
        startTime: null,
        intention: '',
        currentSessionId: null,
    }
};

// ============================================
// DOM Elements
// ============================================

const dom = {
    // Disc
    disc: document.getElementById('disc'),
    timerDisplay: document.getElementById('timer-display'),
    discLabel: document.getElementById('disc-label'),
    progressRing: document.getElementById('progress-ring'),

    // Sound bar
    soundBtns: document.querySelectorAll('.sound-btn'),

    // Controls
    presetBtns: document.querySelectorAll('.preset-btn'),
    customDurationBtn: document.getElementById('custom-duration-btn'),
    finishBtn: document.getElementById('finish-btn'),

    // Footer
    journalBtn: document.getElementById('journal-btn'),
    historyBtn: document.getElementById('history-btn'),
    settingsBtn: document.getElementById('settings-btn'),

    // Modals
    intentionModal: document.getElementById('intention-modal'),
    reflectionModal: document.getElementById('reflection-modal'),
    durationModal: document.getElementById('duration-modal'),
    historyModal: document.getElementById('history-modal'),
    settingsModal: document.getElementById('settings-modal'),

    // Journal
    intentionInput: document.getElementById('intention'),
    reflectionInput: document.getElementById('reflection'),
    sessionSummary: document.getElementById('session-summary'),
    intentionSkip: document.getElementById('intention-skip'),
    intentionStart: document.getElementById('intention-start'),
    reflectionSkip: document.getElementById('reflection-skip'),
    reflectionSave: document.getElementById('reflection-save'),

    // Custom duration
    customMinutes: document.getElementById('custom-minutes'),
    setDurationBtn: document.getElementById('set-duration-btn'),

    // History
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    exportHistory: document.getElementById('export-history'),

    // Bell list (in settings)
    bellList: document.getElementById('bell-list'),

    // Settings
    themeBtns: document.querySelectorAll('.theme-btn'),
    bellVolume: document.getElementById('bell-volume'),
    ambientVolume: document.getElementById('ambient-volume'),
    clearData: document.getElementById('clear-data'),
};

// ============================================
// Audio Engine (Web Audio API)
// ============================================

const AudioEngine = {
    init() {
        if (!state.audio.audioContext) {
            state.audio.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return state.audio.audioContext;
    },

    resume() {
        if (state.audio.audioContext && state.audio.audioContext.state === 'suspended') {
            state.audio.audioContext.resume();
        }
    },

    playBell(bellId = state.settings.bellId) {
        const ctx = this.init();
        this.resume();

        const bell = CONFIG.bells[bellId];
        const now = ctx.currentTime;

        // Create oscillator for the fundamental tone
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(bell.frequency, now);

        gainNode.gain.setValueAtTime(state.settings.bellVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + bell.decay);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + bell.decay);

        // Add harmonics for richer sound
        const harmonics = [2, 3, 4];
        harmonics.forEach((h) => {
            const harmOsc = ctx.createOscillator();
            const harmGain = ctx.createGain();

            harmOsc.type = 'sine';
            harmOsc.frequency.setValueAtTime(bell.frequency * h, now);

            const harmVolume = state.settings.bellVolume / (h * 2);
            harmGain.gain.setValueAtTime(harmVolume, now);
            harmGain.gain.exponentialRampToValueAtTime(0.001, now + bell.decay * 0.8);

            harmOsc.connect(harmGain);
            harmGain.connect(ctx.destination);

            harmOsc.start(now);
            harmOsc.stop(now + bell.decay);
        });
    },

    startAmbient(channelId) {
        this.stopAmbient();

        const channel = CONFIG.channels[channelId];
        if (!channel || (channel.src === null && channel.type !== 'generated')) {
            state.audio.isPlaying = false;
            return;
        }

        const ctx = this.init();
        this.resume();

        state.audio.gainNode = ctx.createGain();
        state.audio.gainNode.gain.setValueAtTime(state.settings.ambientVolume, ctx.currentTime);
        state.audio.gainNode.connect(ctx.destination);
        state.audio.isPlaying = true;

        if (channel.type === 'generated') {
            this.generateAmbient(channel);
        } else if (channel.src) {
            this.playAudioFile(channel.src);
        }
    },

    generateAmbient(channel) {
        const ctx = state.audio.audioContext;
        const now = ctx.currentTime;

        if (channel.frequency === 'noise') {
            // Generate pink noise for rain-like sound
            const bufferSize = 2 * ctx.sampleRate;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }

            const source = ctx.createBufferSource();
            source.buffer = noiseBuffer;
            source.loop = true;
            source.connect(state.audio.gainNode);
            source.start();
            state.audio.currentSource = source;

        } else if (channel.frequency === 'waves') {
            // Generate ocean waves using oscillators
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();

            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.1, now);
            lfoGain.gain.setValueAtTime(0.3, now);

            lfo.connect(lfoGain);
            lfoGain.connect(state.audio.gainNode.gain);

            // Noise oscillator
            const bufferSize = 2 * ctx.sampleRate;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const source = ctx.createBufferSource();
            source.buffer = noiseBuffer;
            source.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);

            source.connect(filter);
            filter.connect(state.audio.gainNode);
            source.start();
            lfo.start();

            state.audio.currentSource = source;
            state.audio.currentLfo = lfo;

        } else if (typeof channel.frequency === 'number') {
            // Generate a drone tone
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(channel.frequency, now);

            // Add slight vibrato
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.2, now);
            lfoGain.gain.setValueAtTime(2, now);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            osc.connect(state.audio.gainNode);
            osc.start();
            lfo.start();

            state.audio.currentSource = osc;
            state.audio.currentLfo = lfo;
        }
    },

    playAudioFile(src) {
        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = state.settings.ambientVolume;
        audio.play().catch(console.error);
        state.audio.htmlAudio = audio;
        state.audio.isPlaying = true;
    },

    stopAmbient() {
        if (state.audio.currentSource) {
            try { state.audio.currentSource.stop(); } catch (e) { }
            state.audio.currentSource = null;
        }
        if (state.audio.currentLfo) {
            try { state.audio.currentLfo.stop(); } catch (e) { }
            state.audio.currentLfo = null;
        }
        if (state.audio.htmlAudio) {
            state.audio.htmlAudio.pause();
            state.audio.htmlAudio = null;
        }
        state.audio.isPlaying = false;
    },

    setAmbientVolume(volume) {
        state.settings.ambientVolume = volume;
        if (state.audio.gainNode && state.audio.audioContext) {
            state.audio.gainNode.gain.setValueAtTime(volume, state.audio.audioContext.currentTime);
        }
        if (state.audio.htmlAudio) {
            state.audio.htmlAudio.volume = volume;
        }
    }
};

// ============================================
// Timer Functions
// ============================================

const Timer = {
    start() {
        if (state.timer.isRunning) return;

        AudioEngine.init();
        AudioEngine.resume();

        state.timer.isRunning = true;
        state.timer.isPaused = false;

        if (!state.session.startTime) {
            state.session.startTime = new Date();
        }

        dom.disc.classList.add('active');
        dom.finishBtn.classList.add('visible');
        this.updateLabel();
        this.updateDisplay();

        state.timer.intervalId = setInterval(() => {
            state.timer.remaining--;
            this.updateDisplay();

            if (state.timer.remaining <= 0) {
                this.complete();
            }
        }, 1000);
    },

    pause() {
        if (!state.timer.isRunning) return;

        state.timer.isRunning = false;
        state.timer.isPaused = true;
        clearInterval(state.timer.intervalId);
        dom.disc.classList.remove('active');
        this.updateLabel();
    },

    reset() {
        this.pause();
        state.timer.remaining = state.timer.duration;
        state.timer.isPaused = false;
        state.session.active = false;
        state.session.startTime = null;
        state.session.intention = '';
        state.session.currentSessionId = null;
        dom.finishBtn.classList.remove('visible');
        this.updateDisplay();
        this.updateProgress(0);
        this.updateLabel();
    },

    complete() {
        this.pause();
        state.timer.remaining = 0;
        this.updateDisplay();
        this.updateProgress(1);

        // Play bell
        AudioEngine.playBell();

        // Save session
        state.session.currentSessionId = this.saveSession();

        // Show reflection modal
        setTimeout(() => {
            showReflectionModal();
        }, 500);
    },

    // Finish early - same as complete but records actual time
    finishEarly() {
        if (!state.session.active) return;

        const actualDuration = state.timer.duration - state.timer.remaining;
        this.pause();
        this.updateProgress(1);

        AudioEngine.playBell();

        // Save session with actual duration
        state.session.currentSessionId = this.saveSession(actualDuration);

        setTimeout(() => {
            showReflectionModal();
        }, 500);
    },

    setDuration(seconds) {
        // Don't allow changing duration mid-session
        if (state.session.active) return;

        state.timer.duration = seconds;
        state.timer.remaining = seconds;
        this.updateDisplay();
        this.updateProgress(0);
        Storage.saveSetting('lastDuration', seconds);

        // Update active preset button
        dom.presetBtns.forEach(btn => {
            const btnDuration = parseInt(btn.dataset.duration);
            btn.classList.toggle('active', btnDuration === seconds);
        });
    },

    updateDisplay() {
        const minutes = Math.floor(state.timer.remaining / 60);
        const seconds = state.timer.remaining % 60;
        dom.timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const progress = 1 - (state.timer.remaining / state.timer.duration);
        this.updateProgress(progress);
    },

    updateProgress(progress) {
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);
        dom.progressRing.style.strokeDashoffset = offset;
    },

    updateLabel() {
        if (state.timer.isRunning) {
            dom.discLabel.textContent = 'tap to pause';
        } else if (state.timer.isPaused) {
            dom.discLabel.textContent = 'tap to resume';
        } else {
            dom.discLabel.textContent = 'tap to begin';
        }
    },

    saveSession(actualDuration = null) {
        const duration = actualDuration !== null ? actualDuration : state.timer.duration;
        const session = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            date: state.session.startTime.toISOString(),
            duration: duration,
            intention: state.session.intention,
            reflection: '',
            channel: CONFIG.channels[state.audio.currentChannel].name,
            bellSound: CONFIG.bells[state.settings.bellId].name,
        };

        const sessions = Storage.getSessions();
        sessions.unshift(session);
        Storage.saveSessions(sessions);

        return session.id;
    },

    updateLastSession(reflection) {
        const sessions = Storage.getSessions();
        if (state.session.currentSessionId) {
            const session = sessions.find(s => s.id === state.session.currentSessionId);
            if (session) {
                session.reflection = reflection;
                Storage.saveSessions(sessions);
            }
        }
    }
};

// ============================================
// Sound Functions
// ============================================

const Sound = {
    setChannel(channelId) {
        const wasPlaying = state.audio.isPlaying;
        state.audio.currentChannel = channelId;

        // Update active button
        dom.soundBtns.forEach(btn => {
            const btnChannel = parseInt(btn.dataset.channel);
            btn.classList.toggle('active', btnChannel === channelId);
            btn.classList.remove('playing');
        });

        if (channelId === 0) {
            // Silence - stop audio
            AudioEngine.stopAmbient();
        } else if (wasPlaying || channelId !== 0) {
            // Start new audio
            AudioEngine.startAmbient(channelId);
            if (state.audio.isPlaying) {
                dom.soundBtns.forEach(btn => {
                    if (parseInt(btn.dataset.channel) === channelId) {
                        btn.classList.add('playing');
                    }
                });
            }
        }
    },

    toggle(channelId) {
        if (state.audio.currentChannel === channelId && state.audio.isPlaying) {
            // Same channel, toggle off
            AudioEngine.stopAmbient();
            dom.soundBtns.forEach(btn => btn.classList.remove('playing'));
            // Switch to silence
            this.setChannel(0);
        } else {
            // Different channel or not playing, start it
            this.setChannel(channelId);
        }
    }
};

// ============================================
// Storage
// ============================================

const Storage = {
    KEYS: {
        SESSIONS: 'moment_sessions',
        SETTINGS: 'moment_settings',
    },

    getSessions() {
        try {
            return JSON.parse(localStorage.getItem(this.KEYS.SESSIONS)) || [];
        } catch {
            return [];
        }
    },

    saveSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS)) || {};
        } catch {
            return {};
        }
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    saveSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        this.saveSettings(settings);
    },

    getSetting(key, defaultValue) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.SESSIONS);
        localStorage.removeItem(this.KEYS.SETTINGS);
    }
};

// ============================================
// UI Functions
// ============================================

function handleDiscClick() {
    AudioEngine.init();
    AudioEngine.resume();

    if (state.timer.remaining <= 0) {
        // Timer completed, reset
        Timer.reset();
    } else if (state.timer.isRunning) {
        // Running - pause
        Timer.pause();
    } else if (state.timer.isPaused) {
        // Paused - resume (no intention modal)
        Timer.start();
    } else {
        // Fresh start - show intention modal
        showIntentionModal();
    }
}

function handleDiscLongPress() {
    Timer.reset();
}

// Show intention modal before meditation
function showIntentionModal() {
    dom.intentionInput.value = '';
    openModal(dom.intentionModal);
}

// Start meditation (called from intention modal)
function startMeditation() {
    state.session.intention = dom.intentionInput.value.trim();
    state.session.active = true;
    closeModal(dom.intentionModal);
    Timer.start();
}

// Show reflection modal after meditation completes
function showReflectionModal() {
    dom.reflectionInput.value = '';

    const duration = state.timer.duration;
    const actualTime = duration - state.timer.remaining;
    const minutes = Math.floor((state.timer.remaining === 0 ? duration : actualTime) / 60);

    let summaryHtml = `
    <div class="session-summary-duration">${minutes} min</div>
    <div class="session-summary-label">meditation complete</div>
  `;

    if (state.session.intention) {
        summaryHtml += `<div class="session-summary-intention">"${state.session.intention}"</div>`;
    }

    dom.sessionSummary.innerHTML = summaryHtml;
    openModal(dom.reflectionModal);
}

// Save reflection and reset
function saveReflection() {
    const reflection = dom.reflectionInput.value.trim();
    Timer.updateLastSession(reflection);
    finishSession();
}

// Reset session state
function finishSession() {
    closeModal(dom.reflectionModal);
    Timer.reset();
}

function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        closeModal(modal);
    });
}

function renderBellList() {
    dom.bellList.innerHTML = CONFIG.bells.map(bell => `
    <div class="bell-option ${bell.id === state.settings.bellId ? 'active' : ''}" data-bell-id="${bell.id}">
      ${bell.name}
    </div>
  `).join('');

    dom.bellList.querySelectorAll('.bell-option').forEach(option => {
        option.addEventListener('click', () => {
            const bellId = parseInt(option.dataset.bellId);
            selectBell(bellId);
            AudioEngine.playBell(bellId);
        });
    });
}

function selectBell(bellId) {
    state.settings.bellId = bellId;
    Storage.saveSetting('bellId', bellId);

    dom.bellList.querySelectorAll('.bell-option').forEach(option => {
        option.classList.toggle('active', parseInt(option.dataset.bellId) === bellId);
    });
}

function renderHistory() {
    const sessions = Storage.getSessions();

    if (sessions.length === 0) {
        dom.historyList.style.display = 'none';
        dom.historyEmpty.style.display = 'block';
        return;
    }

    dom.historyList.style.display = 'flex';
    dom.historyEmpty.style.display = 'none';

    dom.historyList.innerHTML = sessions.slice(0, 50).map(session => {
        const date = new Date(session.date);
        const duration = Math.floor(session.duration / 60);

        return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="history-item-duration">${duration} min</span>
        </div>
        ${session.intention || session.reflection ? `
          <div class="history-item-notes">
            ${session.intention ? `<strong>Intention:</strong> ${session.intention}<br>` : ''}
            ${session.reflection ? `<strong>Reflection:</strong> ${session.reflection}` : ''}
          </div>
        ` : ''}
      </div>
    `;
    }).join('');
}

function exportHistory() {
    const sessions = Storage.getSessions();
    const json = JSON.stringify(sessions, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moment-sessions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function setTheme(theme) {
    state.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Storage.saveSetting('theme', theme);

    dom.themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.content = theme === 'dark' ? '#000000' : '#ffffff';
    }
}

function loadSettings() {
    // Theme
    const savedTheme = Storage.getSetting('theme', CONFIG.defaults.theme);
    setTheme(savedTheme);

    // Bell
    const savedBell = Storage.getSetting('bellId', CONFIG.defaults.bellId);
    selectBell(savedBell);

    // Volumes
    const bellVol = Storage.getSetting('bellVolume', CONFIG.defaults.bellVolume * 100);
    const ambientVol = Storage.getSetting('ambientVolume', CONFIG.defaults.ambientVolume * 100);

    dom.bellVolume.value = bellVol;
    dom.ambientVolume.value = ambientVol;
    state.settings.bellVolume = bellVol / 100;
    state.settings.ambientVolume = ambientVol / 100;

    // Last duration
    const lastDuration = Storage.getSetting('lastDuration', CONFIG.defaults.duration);
    Timer.setDuration(lastDuration);
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
    // Disc interaction
    let longPressTimer;
    dom.disc.addEventListener('mousedown', () => {
        longPressTimer = setTimeout(handleDiscLongPress, 500);
    });
    dom.disc.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer);
    });
    dom.disc.addEventListener('mouseleave', () => {
        clearTimeout(longPressTimer);
    });
    dom.disc.addEventListener('click', handleDiscClick);

    // Touch events for mobile
    dom.disc.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(handleDiscLongPress, 500);
    }, { passive: true });
    dom.disc.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });

    // Sound buttons
    dom.soundBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const channelId = parseInt(btn.dataset.channel);
            Sound.toggle(channelId);
        });
    });

    // Duration presets
    dom.presetBtns.forEach(btn => {
        if (btn.id === 'custom-duration-btn') return;
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration);
            Timer.setDuration(duration);
        });
    });

    // Custom duration
    dom.customDurationBtn.addEventListener('click', () => {
        const currentMinutes = Math.floor(state.timer.duration / 60);
        dom.customMinutes.value = currentMinutes;
        openModal(dom.durationModal);
    });

    dom.setDurationBtn.addEventListener('click', () => {
        const minutes = parseInt(dom.customMinutes.value);
        if (minutes > 0 && minutes <= 180) {
            Timer.setDuration(minutes * 60);
            closeModal(dom.durationModal);
        }
    });

    // Finish early button
    dom.finishBtn.addEventListener('click', () => {
        Timer.finishEarly();
    });

    // Footer buttons
    dom.journalBtn.addEventListener('click', () => {
        if (!state.session.active) {
            showIntentionModal();
        }
    });

    dom.historyBtn.addEventListener('click', () => {
        renderHistory();
        openModal(dom.historyModal);
    });

    dom.settingsBtn.addEventListener('click', () => {
        openModal(dom.settingsModal);
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

    // Modal backdrop click to close
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Intention modal buttons
    dom.intentionSkip.addEventListener('click', () => {
        state.session.intention = '';
        state.session.active = true;
        closeModal(dom.intentionModal);
        Timer.start();
    });

    dom.intentionStart.addEventListener('click', () => {
        startMeditation();
    });

    // Reflection modal buttons
    dom.reflectionSkip.addEventListener('click', () => {
        finishSession();
    });

    dom.reflectionSave.addEventListener('click', () => {
        saveReflection();
    });

    // Export history
    dom.exportHistory.addEventListener('click', exportHistory);

    // Theme toggle
    dom.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });

    // Volume sliders
    dom.bellVolume.addEventListener('input', (e) => {
        state.settings.bellVolume = e.target.value / 100;
        Storage.saveSetting('bellVolume', e.target.value);
    });

    dom.ambientVolume.addEventListener('input', (e) => {
        AudioEngine.setAmbientVolume(e.target.value / 100);
        Storage.saveSetting('ambientVolume', e.target.value);
    });

    // Clear data
    dom.clearData.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            Storage.clearAll();
            location.reload();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            handleDiscClick();
        } else if (e.code === 'Escape') {
            closeAllModals();
        } else if (e.code === 'KeyR') {
            Timer.reset();
        }
    });
}

// ============================================
// Service Worker Registration
// ============================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('SW registered:', registration.scope);
        } catch (error) {
            console.log('SW registration failed:', error);
        }
    }
}

// ============================================
// Initialize App
// ============================================

function init() {
    loadSettings();
    renderBellList();
    initEventListeners();
    registerServiceWorker();
    Timer.updateLabel();

    console.log('Moment initialized');
}

document.addEventListener('DOMContentLoaded', init);
