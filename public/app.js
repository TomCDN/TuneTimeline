// --- RESILIENT DIAGNOSTIC SYSTEM (Toggleable) ---
const diagToggle = document.createElement('button');
diagToggle.id = 'diag-toggle';
diagToggle.textContent = '!';
diagToggle.style.cssText = "position: fixed; bottom: 15px; right: 15px; width: 35px; height: 35px; border-radius: 50%; background: #444; color: white; border: 2px solid #666; font-weight: bold; font-size: 18px; cursor: pointer; z-index: 100000; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.5); opacity: 0.7;";
document.body.appendChild(diagToggle);

const diagnosticDiv = document.createElement('div');
diagnosticDiv.id = 'diag-panel';
diagnosticDiv.style.cssText = "position: fixed; bottom: 60px; right: 15px; font-size: 10px; background: rgba(0,0,0,0.9); color: white; padding: 10px; border-radius: 8px; z-index: 99999; border: 1px solid #555; width: 220px; display: none; font-family: monospace; pointer-events: auto;";
diagnosticDiv.innerHTML = `
    <div style="font-weight:bold; border-bottom:1px solid #444; padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between;">
        <span>DIAGNOSTICS</span>
        <span onclick="document.getElementById('diag-panel').style.display='none'" style="cursor:pointer; padding:0 5px;">×</span>
    </div>
    <div id="diag-status" style="color:#aaa">Socket: ...</div>
    <div id="diag-audio" style="color:#ffcc00; margin:3px 0; font-weight:bold;">Audio: Locked 🔒</div>
    <div id="diag-error" style="color:#ff5555; display:none; border:1px solid #ff5555; padding:4px; margin:3px 0; font-size:9px;"></div>
    <div style="display:flex; flex-direction:column; gap:5px; border-top:1px solid #444; margin-top:6px; padding-top:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:9px; color:#888;">Test System</span>
            <div style="display:flex; gap:3px;">
                <button id="diag-beep-btn" style="background:#444; color:white; border:1px solid #666; font-size:9px; padding:2px 5px; border-radius:4px; cursor:pointer;">BEEP 🔔</button>
                <button id="diag-conn-btn" style="background:#444; color:white; border:1px solid #666; font-size:9px; padding:2px 5px; border-radius:4px; cursor:pointer;">CONN 🌐</button>
            </div>
        </div>
        <button id="diag-unlock-btn" style="background:var(--primary); color:white; border:none; font-size:10px; padding:6px; border-radius:4px; cursor:pointer; font-weight:bold; width:100%;">FORCE UNLOCK 🔊</button>
    </div>
    <div id="diag-logs" style="max-height:120px; overflow-y:auto; line-height:1.3; margin-top:5px; font-size:9px; background:#111; padding:4px;"></div>
`;
document.body.appendChild(diagnosticDiv);

diagToggle.onclick = (e) => {
    e.stopPropagation();
    const panel = document.getElementById('diag-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

// Error protection: Append instead of overwrite
window.onerror = function (msg, url, line, col, error) {
    const errorEl = document.getElementById('diag-error');
    if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = `ERR: ${msg} <br> (Line: ${line})`;
    }
    logToOverlay(`!!!! CRASH: ${msg}`);
    return false;
};

function logToOverlay(msg) {
    const logEl = document.getElementById('diag-logs');
    if (logEl) {
        const timestamp = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const entry = document.createElement('div');
        entry.style.borderBottom = "1px solid #222";
        entry.style.padding = "2px 0";
        entry.textContent = `[${timestamp}] ${msg}`;
        logEl.prepend(entry);
        if (logEl.children.length > 20) logEl.lastChild.remove();
    }
}

function updateConnStatus(status, color) {
    const statusEl = document.getElementById('diag-status');
    if (statusEl) {
        statusEl.innerHTML = `Socket: <span style='color:${color}'>${status}</span>`;
    }
}

function updateAudioStatus(status, color) {
    const audioEl = document.getElementById('diag-audio');
    if (audioEl) {
        audioEl.textContent = `Audio: ${status}`;
        audioEl.style.color = color;
    }
}

document.getElementById('diag-unlock-btn').onclick = () => {
    logToOverlay("Manual unlock requested...");
    unlockAudio();
};

document.getElementById('diag-conn-btn').onclick = async () => {
    logToOverlay("Conn Test: Fetching itunes.apple.com...");
    try {
        const start = Date.now();
        // Use a tiny search query as a probe
        const res = await fetch("https://itunes.apple.com/search?term=test&limit=1", { mode: 'no-cors' });
        const duration = Date.now() - start;
        logToOverlay(`Conn Test: REACHABLE (took ${duration}ms) 🌐`);
    } catch (err) {
        logToOverlay(`Conn Test: FAILED ❌ (${err.message})`);
        logToOverlay("Check if iPad blocks outside URLs.");
    }
};

document.getElementById('diag-beep-btn').onclick = () => {
    logToOverlay("Manual Beep requested...");
    playBeep(true);
};

function playBeep(audible = false) {
    try {
        if (!audioCtx || audioCtx.state !== 'running') {
            logToOverlay("Beep: Context not running ❌");
            return;
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(audible ? 0.05 : 0, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
        if (audible) logToOverlay("Beep: SENT 🔔");
    } catch (e) {
        logToOverlay(`Beep Error: ${e.message}`);
    }
}

// Elements
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const gameOverScreen = document.getElementById('game-over-screen');
const playAgainBtn = document.getElementById('play-again-btn');
const startBtn = document.getElementById('start-btn');
const displayRoomCode = document.getElementById('display-room-code');
const gameRoomCode = document.getElementById('game-room-code');
const audioEl = document.getElementById('game-audio');
audioEl.crossOrigin = "anonymous"; // Try to allow Web Audio graph if needed later

// Detailed diagnostics for iPad audio state
audioEl.addEventListener('error', () => {
    const err = audioEl.error;
    logToOverlay(`audioEl Error: ${err ? err.code : '?'}`);
    if (err && err.code === 4) logToOverlay("-> SRC_NOT_SUPPORTED (Check URL/network)");
});
audioEl.addEventListener('stalled', () => logToOverlay("audioEl: Stalled... ⏳"));
audioEl.addEventListener('waiting', () => logToOverlay("audioEl: Waiting for data... ⏳"));
audioEl.addEventListener('canplay', () => logToOverlay("audioEl: Can play! ✅"));
audioEl.addEventListener('playing', () => logToOverlay("audioEl: Playing started 🔊"));
const guessArea = document.getElementById('hitster-guess-area');
const guessArtistInput = document.getElementById('guess-artist');
const guessTitleInput = document.getElementById('guess-title');
const claimTokenBtn = document.getElementById('claim-token-btn');
const targetScoreInput = document.getElementById('target-score-input');
const hostSettings = document.getElementById('host-settings');
const team1NameInput = document.getElementById('team1-name-input');
const team2NameInput = document.getElementById('team2-name-input');
const joinTeamBtns = document.querySelectorAll('.join-team-btn');
const confirmPlacementBtn = document.getElementById('confirm-placement-btn');
const layoutToggleBtn = document.getElementById('layout-toggle-btn');
const revealBtn = document.getElementById('reveal-btn');
const hostControls = document.getElementById('host-controls');

// --- Admin Panel Elements ---
const adminBadge = document.getElementById('admin-badge');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginCancel = document.getElementById('admin-login-cancel');
const adminPanel = document.getElementById('admin-panel');
const playlistUrlInput = document.getElementById('playlist-url-input');
const loadPlaylistBtn = document.getElementById('load-playlist-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const adminTargetScore = document.getElementById('admin-target-score');

let adminTracks = [];

// --- Team/Player Elements ---
const team1List = document.getElementById('team1-list');
const team2List = document.getElementById('team2-list');
const unassignedList = document.getElementById('unassigned-list');

// --- Helper Functions ---
function updatePlayerList(players) {
    if (!unassignedList) return;
    unassignedList.innerHTML = '';
    const playerArray = Array.isArray(players) ? players : (players ? Object.values(players) : []);
    playerArray.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-item';
        const name = typeof p === 'string' ? p : (p.name || 'Onbekend');
        li.textContent = name;
        unassignedList.appendChild(li);
    });
}
// Robust Socket.IO initialization with improved mobile settings
const socket = io({
    transports: ['websocket', 'polling'], // Prefer WebSockets, fall back to polling
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000, // Longer timeout for mobile networks
    forceNew: true
});

// (diagnosticDiv handles status updates)

// (Moved up)

socket.on('connect_error', (err) => {
    console.error("Socket connection error:", err);
    if (document.getElementById('conn-error')) return;
    const div = document.createElement('div');
    div.id = 'conn-error';
    div.style.cssText = "background: red; color: white; padding: 10px; text-align: center; position: fixed; top: 0; width: 100%; z-index: 9999;";
    div.textContent = `Connection error: ${err.message}. Make sure the server is running.`;
    document.body.insertAdjacentElement('afterbegin', div);
});

socket.on('connect', () => {
    const errorEl = document.getElementById('conn-error');
    if (errorEl) errorEl.remove();
    console.log("Connected to server!");
    updateConnStatus("Connected", "green");
});

socket.on('reconnecting', (attempt) => {
    updateConnStatus(`Reconnecting (${attempt})...`, "orange");
});

socket.on('disconnect', (reason) => {
    updateConnStatus(`Disconnected: ${reason}`, "red");
});

socket.on('error-msg', (msg) => {
    showNotification("Fout", msg);
});


// State
let myRoomCode = null;
let myName = "";
let isHost = false;
let myTeam = null; // 'team1', 'team2', or null
let activeTeam = 'team1';
let turnState = 'playing'; // 'playing', 'challenging', 'result'
let teamsData = {};
let currentSongData = null;
let currentPlacement = null; // { teamId, pos }
let currentChallenge = null; // { teamId, pos }
let targetScore = 10;
let roomHistory = [];

// Voting State
let teamVotes = {}; // { sid: pos } - votes from my team
let myVote = null; // My current vote position
let hasVoted = false;
let isCountingDown = false;

// --- iOS Audio Autoplay Unlock ---
let audioUnlocked = false;
let audioCtx = null;
let heartbeatOsc = null;

// Standard 1-second silent MP3 to "prime" the HTML5 audio element
const SILENT_MP3 = "data:audio/mpeg;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAZGFzaABUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzbzZtcDQyAABUWFhYAAAAEAAAA2VuY29kZXIATGF2ZWY1OC4yOS4xMDAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

function unlockAudio() {
    if (audioUnlocked) {
        logToOverlay("Audio: Already unlocked ✅");
        return;
    }
    if (!audioEl) {
        logToOverlay("Audio: Element not found! ❌");
        return;
    }

    updateAudioStatus("Unlocking... ⏳", "#ccff00");
    logToOverlay("Audio: Starting Synchronous Super-Blessing ⚡");

    // 1. Web Audio API Blessing (Crucial for iOS)
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume immediately
        audioCtx.resume();
        logToOverlay(`AudioContext: Resume called (${audioCtx.state})`);

        // Heartbeat: Continuous silent oscillator to keep the context active
        if (!heartbeatOsc) {
            heartbeatOsc = audioCtx.createOscillator();
            heartbeatOsc.frequency.setValueAtTime(440, audioCtx.currentTime);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // Silent
            heartbeatOsc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            heartbeatOsc.start();
            logToOverlay("Audio: Heartbeat active 💓");
        }

        // Play an immediate audible beep to LOCK in the blessing
        const osc = audioCtx.createOscillator();
        const feedbackGain = audioCtx.createGain();
        osc.connect(feedbackGain);
        feedbackGain.connect(audioCtx.destination);
        feedbackGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
        logToOverlay("Audio: Confirmation BEEP sent 🔔");
    } catch (e) {
        logToOverlay(`AudioContext: Error (${e.name})`);
    }

    // 2. HTML5 Audio Priming (IMMEDIATE)
    try {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.src = SILENT_MP3;
        audioEl.load();

        // NO setTimeout here - we must stay within the user gesture window!
        audioEl.play().then(() => {
            audioUnlocked = true;
            updateAudioStatus("OK ✅", "#00ff00");
            logToOverlay("Audio: HTML5 BLESSED ✅");
        }).catch(err => {
            updateAudioStatus("Locked 🔒", "#ffcc00");
            logToOverlay(`Audio: HTML5 FAILED (${err.name})`);
        });
    } catch (e) {
        logToOverlay(`Audio: Prime Error (${e.name})`);
    }
}

// Monitoring: Log context state periodically
setInterval(() => {
    if (audioCtx) {
        if (audioCtx.state !== 'running') {
            logToOverlay(`AudioCtx State: ${audioCtx.state} ⚠️`);
        }
    }
}, 5000);
// (Moved up)

// --- Layout Persistence ---
const savedLayout = localStorage.getItem('gameLayout') || 'mobile';
if (savedLayout === 'desktop') {
    document.body.classList.add('desktop-layout');
    if (layoutToggleBtn) {
        layoutToggleBtn.textContent = '💻';
        layoutToggleBtn.classList.add('active');
    }
}

if (layoutToggleBtn) {
    layoutToggleBtn.addEventListener('click', () => {
        const isDesktop = document.body.classList.toggle('desktop-layout');
        layoutToggleBtn.classList.toggle('active', isDesktop);
        layoutToggleBtn.textContent = isDesktop ? '💻' : '📱';
        localStorage.setItem('gameLayout', isDesktop ? 'desktop' : 'mobile');

        // Refresh timelines if needed (though CSS should handle most)
        if (typeof renderTimelines === 'function') renderTimelines();
    });
}

// --- Navigation ---
function showScreen(screen) {
    [lobbyScreen, waitingScreen, gameScreen, gameOverScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// --- Custom Modal Helper ---
const modal = {
    overlay: document.getElementById('custom-modal'),
    title: document.getElementById('modal-title'),
    message: document.getElementById('modal-message'),
    confirmBtn: document.getElementById('modal-confirm-btn'),
    cancelBtn: document.getElementById('modal-cancel-btn'),

    show(title, msg, onConfirm, onCancel = null) {
        this.title.textContent = title;
        if (msg instanceof HTMLElement) {
            this.message.innerHTML = '';
            this.message.appendChild(msg);
        } else {
            this.message.innerHTML = msg; // allow HTML for static messages
        }
        this.overlay.classList.remove('hidden');
        this.confirmBtn.classList.remove('hidden'); // Ensure button is visible

        // Risky: clones remove listeners, but better for simple logic
        const newConfirm = this.confirmBtn.cloneNode(true);
        const newCancel = this.cancelBtn.cloneNode(true);
        this.confirmBtn.parentNode.replaceChild(newConfirm, this.confirmBtn);
        this.cancelBtn.parentNode.replaceChild(newCancel, this.cancelBtn);

        this.confirmBtn = newConfirm;
        this.cancelBtn = newCancel;

        this.confirmBtn.onclick = () => {
            if (onConfirm) onConfirm();
            this.hide();
        };

        if (onCancel) {
            this.cancelBtn.classList.remove('hidden');
            this.cancelBtn.onclick = () => {
                onCancel();
                this.hide();
            };
        } else {
            this.cancelBtn.classList.add('hidden');
        }
    },

    hide() {
        this.overlay.classList.add('hidden');
    }
};

// Convenience wrappers
function showNotification(title, msg) {
    modal.show(title, msg, null);
    // Auto-close simple notifications if desired, or just let user click Confirm
}

function showConfirm(title, msg, onConfirm) {
    modal.show(title, msg, onConfirm, () => { });
}

// Replace alerts/confirms
function handleChallenge(pos) {
    showConfirm("Challenge", "Weet je het zeker? Dit kost je 1 munt.", () => {
        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'submit-challenge',
            data: {
                teamId: myTeam,
                pos: pos
            }
        });
    });
}

// --- Hitster Token Logic ---
// --- Hitster Token Logic ---
const cleanString = (str) => {
    if (!str) return "";
    return str
        .toLowerCase()
        .replace(/\s*[([].*?[)\]]/g, '') // Remove text in () or []
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[.,/#!$%^&*;:{}=\-_`~]/g, "") // Remove punctuation
        .trim();
};

const checkMatch = (guess, actual, isArtist = false) => {
    const cleanGuess = cleanString(guess);
    const cleanActual = cleanString(actual);

    if (!cleanGuess) return false;

    // Exact match on cleaned strings
    if (cleanGuess === cleanActual) return true;

    // Check if guess is contained in actual (fuzzy)
    if (cleanActual.includes(cleanGuess) && cleanGuess.length > 3) return true;

    // Special artist logic: check individual artists
    if (isArtist) {
        // Split by common separators: &, feat, ft, ,, and /
        const parts = actual.split(/,|&|\/|feat\.|ft\./i).map(cleanString);
        if (parts.some(p => p === cleanGuess || (p.includes(cleanGuess) && cleanGuess.length > 3))) {
            return true;
        }
    }

    return false;
};

claimTokenBtn.addEventListener('click', () => {
    if (!currentSongData) return showNotification("Fout", "Er speelt geen nummer!");
    if (!myTeam) return showNotification("Fout", "Je zit niet in een team!");

    const artistGuess = guessArtistInput.value;
    const titleGuess = guessTitleInput.value;

    // Validatie
    if (!artistGuess.trim() || !titleGuess.trim()) return showNotification("Incompleet", "Vul zowel artiest als titel in!");

    const isArtistCorrect = checkMatch(artistGuess, currentSongData.artist, true);
    const isTitleCorrect = checkMatch(titleGuess, currentSongData.title, false);

    if (isArtistCorrect && isTitleCorrect) {
        showNotification("CORRECT! 🎉", "Je team verdient een Hitster Token!");
        claimTokenBtn.disabled = true;
        claimTokenBtn.innerText = "✅ Token Claimed!";

        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'claim-token',
            data: { teamId: myTeam }
        });
    } else {
        // Optional: give a hint about WHICH one was wrong?
        // User didn't ask for it, but it's "better working system".
        let msg = "Dat was niet goed.";
        if (isArtistCorrect && !isTitleCorrect) msg += " (De artiest was wel goed!)";
        if (!isArtistCorrect && isTitleCorrect) msg += " (De titel was wel goed!)";

        showNotification("Helaas ❌", msg + " Probeer het nog eens!");
    }
});

playAgainBtn.addEventListener('click', () => {
    console.log("Play Again clicked. Room:", myRoomCode);
    if (!myRoomCode) {
        showNotification("Fout", "Geen room code gevonden. Refresh de pagina.");
        return;
    }
    showNotification("Even geduld...", "Game wordt gereset...");
    socket.emit('game-action', { roomCode: myRoomCode, action: 'reset-game' });
});

socket.on('game-reset', () => {
    showScreen(waitingScreen);

    // Stop and reset audio
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.src = '';
    }

    // Clear timelines visually
    document.querySelectorAll('.timeline').forEach(t => t.innerHTML = '<div class="drop-zone" data-pos="0"></div>');

    // Reset local state
    currentSongData = null;
    currentPlacement = null;
    currentChallenge = null;
    teamVotes = {};
    myVote = null;
    hasVoted = false;

    // Clear UI messages
    document.getElementById('song-msg').innerText = "Wachten op volgend nummer...";
    document.getElementById('winner-display').innerText = '';

    if (isHost) startBtn.classList.remove('hidden');

    showNotification("Reset", "De game is gereset! Kies teams en start opnieuw.");
});

// Lobby Actions (fix alerts)
createBtn.addEventListener('click', () => {
    logToOverlay("Click: Create Party");
    unlockAudio();
    myName = usernameInput.value.trim();
    if (!myName) return showNotification("Oeps", "Vul eerst een naam in!");
    isHost = true;
    logToOverlay(`Emit: create-room (${myName})`);
    socket.emit('create-room', myName);
});

joinBtn.addEventListener('click', () => {
    logToOverlay("Click: Join Party");
    unlockAudio();
    myName = usernameInput.value.trim();
    const code = roomInput.value.trim().toUpperCase();
    if (!myName || !code) return showNotification("Oeps", "Vul naam en room code in!");
    // Secondary attempt for iOS
    if (audioEl && !audioUnlocked) {
        audioEl.play().then(() => { audioEl.pause(); audioUnlocked = true; logToOverlay("Audio: Manual Unlock OK"); }).catch(() => { });
    }
    logToOverlay(`Emit: join-room (${code})`);
    socket.emit('join-room', { roomCode: code, userName: myName });
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
    if (!myRoomCode) return showNotification("Fout", "Nog geen party code beschikbaar.");

    // Construct invite message
    const url = window.location.href;
    const msg = `Kom doe mee met TuneTimeline!\n\nWebsite: ${url}\nParty Code: ${myRoomCode}`;

    // Modern copy to clipboard
    navigator.clipboard.writeText(msg).then(() => {
        showNotification("Gekopieerd! 📋", "De uitnodiging is gekopieerd.<br>Stuur hem naar je vrienden!");
    }).catch(err => {
        console.error('Copy failed', err);
        // Fallback or error msg
        showNotification("Fout", "Kon niet kopiëren. Selecteer en kopieer de code zelf.");
    });
});

document.getElementById('randomize-btn').addEventListener('click', () => {
    showConfirm("Teams Husselen", "Wil je alle spelers random verdelen over 2 teams?", () => {
        socket.emit('game-action', { roomCode: myRoomCode, action: 'randomize-teams' });
    });
});


socket.on('challenge-submitted', (data) => {
    currentChallenge = data;
    const msg = document.createElement('div');
    const teamName = document.createElement('b');
    teamName.textContent = teamsData[data.teamId].name;
    msg.appendChild(teamName);
    msg.appendChild(document.createTextNode(' heeft gechallenged!'));
    modal.show("CHALLENGE!", msg);
    renderTimelines();
});

socket.on('year-revealed', ({ results, teams, nextTeam, winner }) => {
    teamsData = teams;
    activeTeam = nextTeam;
    turnState = 'playing';

    const { actualYear, placerCorrect, challengerCorrect, placement, challenge, stolen } = results;

    const resultContainer = document.createElement('div');
    const intro = document.createElement('p');
    intro.innerHTML = `Het jaar was <b>${actualYear}</b>!<br><br>`;
    resultContainer.appendChild(intro);

    const detail = document.createElement('p');
    if (stolen) {
        detail.textContent = `🔥 GESTOLEN! ${teamsData[challenge.teamId].name} had het goed en pakt de kaart af!`;
    } else {
        const placerStatus = document.createElement('span');
        placerStatus.textContent = `${teamsData[placement.teamId].name} was `;
        const correctness = document.createElement('span');
        correctness.textContent = placerCorrect ? 'CORRECT' : 'FOUT';
        correctness.style.color = placerCorrect ? '#22c55e' : '#ef4444';
        placerStatus.appendChild(correctness);
        placerStatus.appendChild(document.createTextNode('.'));
        detail.appendChild(placerStatus);

        if (challenge) {
            const challengeDetail = document.createElement('div');
            challengeDetail.textContent = `${teamsData[challenge.teamId].name}'s challenge was FOUT.`;
            detail.appendChild(challengeDetail);
        }
    }
    resultContainer.appendChild(detail);

    if (winner) {
        modal.hide(); // Close any existing modal
        showScreen(gameOverScreen);
        document.getElementById('winner-display').innerText = `🏆 ${winner} 🏆`;

        let endMsg = `Het laatste jaar was ${actualYear}.`;
        if (isHost) {
            playAgainBtn.classList.remove('hidden');
        } else {
            playAgainBtn.classList.add('hidden');
            endMsg += "<br>Wachten op de host...";
        }
        document.getElementById('game-over-msg').innerHTML = endMsg;
        return; // Stop here, don't render normal result modal
    }

    modal.show("Resultaat", resultContainer.innerHTML);

    currentSongData = null;
    currentPlacement = null;
    currentChallenge = null;

    // Hide the Reveal Year button after reveal
    hostControls.classList.add('hidden');

    renderTimelines();

    document.getElementById('song-msg').innerText = "Waiting for next song...";
    if (isHost) {
        setTimeout(fetchNextSong, 3000); // Wait a bit longer so people can read result
    }
});

socket.on('error-msg', (msg) => {
    showNotification("Error", msg);
    loadPlaylistBtn.innerText = "Load Playlist";
    loadPlaylistBtn.disabled = false;
});

socket.on('playlist-loaded', ({ count, tracks }) => {
    adminTracks = tracks;
    showNotification("Playlist Geladen", `Loaded ${count} tracks from Spotify!`);
    loadPlaylistBtn.innerText = "Load Playlist";
    loadPlaylistBtn.disabled = false;
});

// Update updateDebugDisplay if you want to keep it, but removing interval to clean up
clearInterval(1); // Try to clear naive interval ID or just omit starting it
if (document.querySelector('div[style*="lime"]')) document.querySelector('div[style*="lime"]').remove();


targetScoreInput.addEventListener('change', () => {
    if (!isHost) return;
    socket.emit('game-action', { roomCode: myRoomCode, action: 'set-target-score', data: targetScoreInput.value });
});

startBtn.addEventListener('click', () => {
    socket.emit('game-action', { roomCode: myRoomCode, action: 'start-game' });
});

// Join Team
joinTeamBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        socket.emit('join-team', { roomCode: myRoomCode, team: team });
    });
});

// Set Team Name (Host Only)
[team1NameInput, team2NameInput].forEach(input => {
    input.addEventListener('change', () => {
        if (!isHost) return;
        const team = input.id.includes('team1') ? 'team1' : 'team2';
        socket.emit('set-team-name', { roomCode: myRoomCode, team: team, name: input.value.trim() });
    });
});

// Oracle Selector (Host Only)
['team1', 'team2'].forEach(teamId => {
    const selectEl = document.getElementById(`${teamId}-oracle-select`);
    if (selectEl) {
        selectEl.addEventListener('change', () => {
            if (!isHost) return;
            socket.emit('game-action', {
                roomCode: myRoomCode,
                action: 'set-oracle',
                data: {
                    teamId: teamId,
                    oracleSid: selectEl.value || null
                }
            });
        });
    }
});

// --- Socket Events ---
socket.on('room-created', ({ roomCode, userName }) => {
    logToOverlay(`Recv: room-created (${roomCode})`);
    myRoomCode = roomCode;
    displayRoomCode.innerText = roomCode;
    startBtn.classList.remove('hidden');
    showScreen(waitingScreen);
    updatePlayerList([{ name: userName }]);
});

socket.on('playlist-loaded', ({ count, tracks }) => {
    logToOverlay(`Recv: playlist-loaded (${count})`);
    adminTracks = tracks;
    loadPlaylistBtn.innerText = "Load";
    loadPlaylistBtn.disabled = false;
    showNotification("Success", `Playlist geladen! ${count} nummers toegevoegd aan de wachtrij.`);
});

socket.on('error-msg', (msg) => {
    loadPlaylistBtn.innerText = "Load";
    loadPlaylistBtn.disabled = false;
    showNotification("Fout", msg);
});

socket.on('joined-room', ({ roomCode, players }) => {
    myRoomCode = roomCode;
    displayRoomCode.innerText = roomCode;
    showScreen(waitingScreen);
    updatePlayerList(players);
});

socket.on('player-joined', (players) => {
    // Legacy support or simplified list
});

socket.on('room-update', (data) => {
    const { roomCode, players, teams, gameState, turnState: serverTurnState, activeTeam: serverActiveTeam, currentPlacement: serverPlacement, currentChallenge: serverChallenge, targetScore: serverTargetScore, playlistTracks, history: serverHistory, host: serverHostSid } = data;

    // Sync host status
    if (serverHostSid) {
        isHost = (serverHostSid === socket.id);
    }
    myRoomCode = roomCode;
    displayRoomCode.innerText = roomCode;
    teamsData = teams;
    activeTeam = serverActiveTeam || activeTeam;
    turnState = serverTurnState || turnState;
    currentPlacement = serverPlacement;
    currentChallenge = serverChallenge;
    targetScore = serverTargetScore || targetScore;

    // Store history
    roomHistory = serverHistory || [];

    if (isHost) {
        // Show host controls when game is playing AND there's a placement to reveal
        const shouldShowReveal = gameState === 'playing' && serverPlacement && serverTurnState === 'challenging';
        hostControls.classList.toggle('hidden', !shouldShowReveal);
        hostSettings.classList.remove('hidden');
        document.getElementById('randomize-btn').classList.remove('hidden'); // Show random button

        if (document.activeElement !== targetScoreInput) targetScoreInput.value = targetScore;

        // Sync playlist tracks if host refreshes
        if (playlistTracks && playlistTracks.length > 0) {
            adminTracks = playlistTracks;
        }
    } else {
        hostControls.classList.add('hidden'); // Hide for non-hosts
        hostSettings.classList.add('hidden');
        document.getElementById('randomize-btn').classList.add('hidden');
    }

    // Update Team Names (if not focused)
    if (document.activeElement !== team1NameInput) team1NameInput.value = teams.team1.name;
    if (document.activeElement !== team2NameInput) team2NameInput.value = teams.team2.name;

    // Disable inputs for non-hosts
    team1NameInput.disabled = !isHost;
    team2NameInput.disabled = !isHost;

    // Render Player Lists
    const renderList = (listEl, players) => {
        listEl.innerHTML = ''; // Clear first
        players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'player-item';
            const span = document.createElement('span');
            span.className = 'player-name';
            span.textContent = `${p.name} ${p.sid === socket.id ? '(You)' : ''}`;
            li.appendChild(span);
            listEl.appendChild(li);
        });
    };

    renderList(team1List, teams.team1.players);
    renderList(team2List, teams.team2.players);

    // Oracle selector logic (only shown when team has even players >= 2)
    ['team1', 'team2'].forEach(teamId => {
        const team = teams[teamId];
        const selectorDiv = document.getElementById(`${teamId}-oracle-selector`);
        const selectEl = document.getElementById(`${teamId}-oracle-select`);

        if (selectorDiv && selectEl) {
            const hasEvenPlayers = team.players.length >= 2 && team.players.length % 2 === 0;

            if (hasEvenPlayers) {
                selectorDiv.classList.remove('hidden');

                // Only host can change Oracle
                selectEl.disabled = !isHost;

                // Populate dropdown with team members
                selectEl.innerHTML = '<option value="">Geen</option>' +
                    team.players.map(p =>
                        `<option value="${p.sid}" ${team.oracle === p.sid ? 'selected' : ''}>${p.name}</option>`
                    ).join('');
            } else {
                selectorDiv.classList.add('hidden');
            }
        }
    });

    // Filter unassigned
    const assignedSids = [...teams.team1.players, ...teams.team2.players].map(p => p.sid);
    const unassignedItems = Object.entries(players)
        .filter(([sid]) => !assignedSids.includes(sid))
        .map(([sid, name]) => ({ sid, name }));

    unassignedList.innerHTML = '';
    unassignedItems.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-item';
        const span = document.createElement('span');
        span.textContent = `${p.name} ${p.sid === socket.id ? '(You)' : ''}`;
        li.appendChild(span);
        unassignedList.appendChild(li);
    });

    // Start Button visibility
    if (isHost && teams.team1.players.length > 0 && teams.team2.players.length > 0) {
        startBtn.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
    }

    // Screen transitions
    if (gameState === 'lobby' && waitingScreen.classList.contains('hidden')) {
        showScreen(waitingScreen);
    }
    if (gameState === 'playing' && !isCountingDown) {
        if (gameScreen.classList.contains('hidden')) showScreen(gameScreen);
        renderTimelines();
        renderChallengeInterface(); // Update interface
    }

    // Find my team
    const myPlayer = Object.entries(players).find(([sid]) => sid === socket.id);
    if (myPlayer) {
        if (teams.team1.players.some(p => p.sid === socket.id)) myTeam = 'team1';
        else if (teams.team2.players.some(p => p.sid === socket.id)) myTeam = 'team2';
        else myTeam = null;
    }
});

function renderChallengeInterface() {
    const interfaceEl = document.getElementById('challenge-interface');
    const optionsGrid = document.getElementById('challenge-options');
    const skipBtn = document.getElementById('skip-challenge-btn');
    const targetTeamSpan = document.getElementById('challenger-target-team');

    // Only show if we are in challenging phase
    if (turnState !== 'challenging' || !currentPlacement) {
        interfaceEl.classList.add('hidden');
        return;
    }

    // Show interface only for the CHALLENGER team
    // Active Team placed the card. The OTHER team is the challenger.
    const placerTeamId = activeTeam; // Team who placed
    const challengerTeamId = activeTeam === 'team1' ? 'team2' : 'team1';

    if (myTeam !== challengerTeamId) {
        // I am the placer, or a spectator, or not in the game
        // Optional: Show "Waiting for opponent to challenge..."
        interfaceEl.classList.add('hidden');
        document.getElementById('song-msg').innerText = `Wachten op challenge van ${teamsData[challengerTeamId].name}...`;
        return;
    }

    // I am the challenger!
    interfaceEl.classList.remove('hidden');
    targetTeamSpan.innerText = teamsData[placerTeamId].name;
    document.getElementById('song-msg').innerText = "JOUW BEURT! Klopt de kaart?";

    optionsGrid.innerHTML = '';

    const timeline = teamsData[placerTeamId].timeline;
    // Possible positions are 0 to timeline.length
    // The placer chose 'currentPlacement.pos'

    // Generate buttons for ALL gaps
    for (let i = 0; i <= timeline.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'challenge-btn';

        // Label logic
        const label = document.createElement('small');
        if (i === 0) label.textContent = `Begin (Voor ${timeline[0].title})`;
        else if (i === timeline.length) label.textContent = `Einde (Na ${timeline[i - 1].title})`;
        else label.textContent = `Tussen ${timeline[i - 1].title} en ${timeline[i].title}`;

        const posStrong = document.createElement('strong');
        posStrong.textContent = `Positie ${i + 1}`;

        btn.appendChild(posStrong);
        btn.appendChild(document.createElement('br'));
        btn.appendChild(label);

        // Check if this is the spot the placer chose
        if (i === currentPlacement.pos) {
            btn.classList.add('blocked');
            btn.innerHTML += `<br><em style="color:var(--text-muted)">(Gekozen door ${teamsData[placerTeamId].name})</em>`;
            btn.disabled = true;
        } else {
            btn.onclick = () => {
                // Ensure tokens
                if (teamsData[myTeam].tokens > 0) {
                    handleChallenge(i);
                } else {
                    showNotification("Helaas", "Je hebt geen tokens meer om te challengen!");
                }
            };
        }

        optionsGrid.appendChild(btn);
    }

    // Skip button - triggers auto-reveal without challenging
    skipBtn.onclick = () => {
        showConfirm("Niet Challengen", "Zeker weten? Als je niet challenget, ga je er vanuit dat ze het goed hebben.", () => {
            socket.emit('game-action', {
                roomCode: myRoomCode,
                action: 'skip-challenge',
                data: { teamId: myTeam }
            });
            interfaceEl.classList.add('hidden');
            document.getElementById('song-msg').innerText = "Geen challenge - jaar wordt onthuld...";
        });
    };
}

socket.on('start-ready-phase', () => {
    logToOverlay("Ready Phase Started");

    const container = document.createElement('div');
    container.style.textAlign = 'center';

    const msg = document.createElement('p');
    msg.id = 'ready-status-text';
    msg.innerHTML = "Iedereen moet op de knop drukken om de muziek te activeren.<br><br><b>Klaar voor de start?</b>";
    container.appendChild(msg);

    const btn = document.createElement('button');
    btn.id = 'vote-to-start-btn';
    btn.className = 'primary-btn';
    btn.style.marginTop = '15px';
    btn.textContent = 'Vote to Start';
    btn.onclick = () => {
        logToOverlay("Click: Vote to Start");
        unlockAudio();
        socket.emit('game-action', { roomCode: myRoomCode, action: 'player-ready' });

        btn.disabled = true;
        btn.textContent = "Waiting for the other players...";
        btn.style.opacity = '0.7';
    };
    container.appendChild(btn);

    modal.show("ARE YOU READY!?", container);

    const modalConfirm = document.getElementById('modal-confirm-btn');
    if (modalConfirm) modalConfirm.classList.add('hidden');
});

socket.on('ready-progress', ({ readyCount, totalPlayers }) => {
    const statusText = document.getElementById('ready-status-text');
    if (statusText) {
        statusText.innerHTML = `Iedereen moet op de knop drukken om de muziek te activeren.<br><br><b>Status: ${readyCount} / ${totalPlayers} spelers klaar.</b>`;
    }
});


socket.on('game-started', async () => {
    logToOverlay("Game Started! 🚀");
    isCountingDown = true;

    // Perform countdown inside the modal button if it exists
    const btn = document.getElementById('vote-to-start-btn');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '1';
        btn.style.background = 'var(--primary)';

        btn.textContent = "3...";
        await new Promise(r => setTimeout(r, 1000));
        btn.textContent = "2...";
        await new Promise(r => setTimeout(r, 1000));
        btn.textContent = "1...";
        await new Promise(r => setTimeout(r, 1000));
        btn.textContent = "START!";
        await new Promise(r => setTimeout(r, 500));
    }

    isCountingDown = false;
    modal.hide();
    gameRoomCode.innerText = myRoomCode;
    showScreen(gameScreen);

    if (isHost) {
        // Initialize Timelines with one card each
        try {
            console.log("Fetching starter songs in parallel...");
            const [team1Song, team2Song] = await Promise.all([
                getTeamStarterSong(),
                getTeamStarterSong()
            ]);
            socket.emit('game-action', {
                roomCode: myRoomCode,
                action: 'init-starter-cards',
                data: { team1Song, team2Song }
            });
            setTimeout(fetchNextSong, 1500); // Slightly faster delay
        } catch (err) {
            console.error("Failed to init starter cards:", err);
            renderTimelines();
        }
    }
});

async function getTeamStarterSong() {
    const genres = ['classic', 'hits', 'pop'];
    const genre = genres[Math.floor(Math.random() * genres.length)];
    const response = await fetch(`https://itunes.apple.com/search?term=${genre}&media=music&limit=20`);
    const data = await response.json();
    const results = data.results.filter(t => t.previewUrl);
    const track = results[Math.floor(Math.random() * results.length)];
    return {
        title: track.trackName,
        artist: track.artistName,
        year: new Date(track.releaseDate).getFullYear(),
        url: track.previewUrl
    };
}

socket.on('new-song', ({ songData, activeTeam: serverActiveTeam, turnState: serverTurnState }) => {
    activeTeam = serverActiveTeam;
    turnState = serverTurnState;
    currentSongData = songData;
    currentPlacement = null;
    currentChallenge = null;

    // Reset voting state
    teamVotes = {};
    myVote = null;
    hasVoted = false;

    logToOverlay(`Song: ${songData.artist} - ${songData.title}`);
    logToOverlay(`Source: ${songData.url.substring(0, 40)}...`);

    audioEl.src = songData.url;
    audioEl.load(); // Force load on mobile

    logToOverlay(`audioEl state: rS=${audioEl.readyState}, nS=${audioEl.networkState}`);

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            logToOverlay("Audio: Playing SUCCESS! 🎶");
            document.getElementById('song-msg').innerText = `${teamsData[activeTeam].name}'s Turn: Where does this fit?`;
        }).catch(err => {
            logToOverlay("Audio: BLOCKED ⏸️ (Play manually)");
            console.warn("Autoplay blocked or failed:", err);
            // Show a BIG manual play button if blocked
            document.getElementById('song-msg').innerHTML = `
                <div style="padding: 10px; border: 2px solid var(--primary); border-radius: 10px; background: rgba(0,0,0,0.3); margin-top: 10px;">
                    <p style="color:var(--primary); font-weight:bold; margin-bottom:5px;">⚠️ Muziek is gepauzeerd door je browser.</p>
                    <button id="manual-play-trigger" class="primary-btn" style="width:auto; display:inline-flex; padding: 15px 30px; font-size: 1.2em;">▶️ START MUZIEK</button>
                </div>
            `;
            const trigger = document.getElementById('manual-play-trigger');
            if (trigger) {
                trigger.onclick = () => {
                    audioEl.play().then(() => {
                        logToOverlay("Audio: Manual Play OK");
                        document.getElementById('song-msg').innerText = `${teamsData[activeTeam].name}'s Turn: Where does this fit?`;
                    });
                };
            }
        });
    }

    // Highlight active team
    document.querySelectorAll('.team-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${activeTeam}-section`).classList.add('active');

    // Show guess area for current team
    if (myTeam === activeTeam) {
        guessArea.classList.remove('hidden');

        // Reset Token Inputs
        guessArtistInput.value = '';
        guessTitleInput.value = '';
        guessArtistInput.disabled = false;
        guessTitleInput.disabled = false;

        claimTokenBtn.disabled = false;
        claimTokenBtn.innerText = "💰 Guess for Token";

        // Show/hide confirm button based on team size
        const teamSize = teamsData[myTeam].players.length;
        if (teamSize > 1 && confirmPlacementBtn) {
            confirmPlacementBtn.classList.remove('hidden');
            confirmPlacementBtn.disabled = true;
            confirmPlacementBtn.innerText = "⏳ Wacht op stemmen...";
        }
    } else {
        guessArea.classList.add('hidden');
        if (confirmPlacementBtn) confirmPlacementBtn.classList.add('hidden');
    }

    renderTimelines();
});

socket.on('placement-submitted', ({ teamId, pos, turnState: serverTurnState }) => {
    turnState = serverTurnState;
    currentPlacement = { teamId, pos };

    const otherTeam = activeTeam === 'team1' ? 'team2' : 'team1';
    if (myTeam === otherTeam && teamsData[myTeam].tokens > 0) {
        document.getElementById('song-msg').innerText = `CHALLENGE! ${teamsData[activeTeam].name} placed it. If you think they are wrong, spend a token!`;
    } else {
        document.getElementById('song-msg').innerText = "Waiting for challenge phase...";
    }

    // Show Reveal Year button for host when in challenging phase
    if (isHost && turnState === 'challenging' && currentPlacement) {
        hostControls.classList.remove('hidden');
    }

    guessArea.classList.add('hidden');
    renderTimelines();
    renderChallengeInterface();
});

// [Duplicate handlers removed]

socket.on('token-claimed-announcement', ({ teamId, claimedBy }) => {
    // If it's my team, update UI
    if (teamId === myTeam) {
        claimTokenBtn.disabled = true;
        claimTokenBtn.textContent = `✅ Token Claimed by ${claimedBy}!`;
        guessArtistInput.disabled = true;
        guessTitleInput.disabled = true;

        if (claimedBy !== myName) {
            const msg = document.createElement('div');
            msg.textContent = `${claimedBy} heeft de token verdiend voor je team!`;
            modal.show("Goed gedaan!", msg);
        }
    }
});

socket.on('player-guessed', ({ playerId, songData, pos }) => {
    // Other players see animations/updates here
    console.log(`Player ${playerId} placed song at ${pos}`);
});

function updateLobbyUI(players, teams) {
    // Already handled in room-update, but ensuring consistency
    team1NameInput.value = teams.team1.name;
    team2NameInput.value = teams.team2.name;
}

// --- Timeline Logic ---
function renderTimelines() {
    ['team1', 'team2'].forEach(teamId => {
        const timelineEl = document.getElementById(`${teamId}-timeline`);
        const team = teamsData[teamId];

        document.getElementById(`${teamId}-display-name`).innerText = team.name;
        document.getElementById(`${teamId}-score`).innerText = team.score;
        // Show tokens as physical coins (Visual only)
        const tokenBar = document.getElementById(`${teamId}-tokens-bar`);
        tokenBar.innerHTML = '';

        // If this team has an active challenge, one token is "in the game" and not in the bar
        const isChallenging = currentChallenge && currentChallenge.teamId === teamId;
        const barCount = isChallenging ? team.tokens - 1 : team.tokens;

        for (let i = 0; i < barCount; i++) {
            const token = document.createElement('div');
            token.className = 'hitster-token';
            token.innerText = 'H';
            token.setAttribute('draggable', 'false'); // No longer draggable
            tokenBar.appendChild(token);
        }

        timelineEl.innerHTML = '<div class="drop-zone" data-pos="0"><span>+</span></div>';

        team.timeline.forEach((song, index) => {
            const card = document.createElement('div');
            card.className = 'music-card';

            const yearDiv = document.createElement('div');
            yearDiv.className = 'year';
            yearDiv.textContent = song.year;

            const titleDiv = document.createElement('div');
            titleDiv.className = 'title';
            titleDiv.textContent = song.title;

            const artistDiv = document.createElement('div');
            artistDiv.className = 'artist';
            artistDiv.textContent = song.artist;

            card.appendChild(yearDiv);
            card.appendChild(titleDiv);
            card.appendChild(artistDiv);
            timelineEl.appendChild(card);

            const zone = document.createElement('div');
            zone.className = 'drop-zone';
            zone.dataset.pos = index + 1;
            zone.innerHTML = '<span>+</span>';
            timelineEl.appendChild(zone);
        });

        // Show pending placement (Hidden Year)
        if (currentPlacement && currentPlacement.teamId === teamId) {
            const card = document.createElement('div');
            card.className = 'music-card pending';

            const yearDiv = document.createElement('div');
            yearDiv.className = 'year';
            yearDiv.textContent = '????';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'title';
            titleDiv.textContent = currentSongData.title;

            const artistDiv = document.createElement('div');
            artistDiv.className = 'artist';
            artistDiv.textContent = currentSongData.artist;

            card.appendChild(yearDiv);
            card.appendChild(titleDiv);
            card.appendChild(artistDiv);
            const zones = timelineEl.querySelectorAll('.drop-zone');
            // Zones are: [0] [Card] [1] [Card] [2] ...
            // If pos is 1, it goes after [1]
            if (zones[currentPlacement.pos]) {
                zones[currentPlacement.pos].after(card);
            }
        }

        // Logic for Drop Zones (STATE / VISUALS ONLY)
        const zones = timelineEl.querySelectorAll('.drop-zone');
        zones.forEach(zone => {
            const pos = parseInt(zone.dataset.pos);

            // Check if this zone should be hidden/disabled
            const isActivePlacement = currentPlacement && currentPlacement.teamId === teamId && currentPlacement.pos === pos;

            // Show token if this zone is challenged
            if (currentChallenge && currentChallenge.pos === pos && teamId === activeTeam) {
                const token = document.createElement('div');
                token.className = 'hitster-token';
                token.innerText = 'H';
                zone.innerHTML = ''; // Clear (+)
                zone.appendChild(token);
            }

            // Visual States
            zone.classList.remove('clickable-challenge', 'clickable-placement', 'disabled-zone', 'my-vote');
            zone.style.visibility = 'visible';

            // Show vote counts on own team's timeline (opponent can't see)
            if (teamId === myTeam && myTeam === activeTeam && turnState === 'playing' && Object.keys(teamVotes).length > 0) {
                // Count votes for this position
                const votesForPos = Object.values(teamVotes).filter(v => v === pos).length;

                // Check if this is my vote
                if (myVote === pos) {
                    zone.classList.add('my-vote');
                }

                if (votesForPos > 0) {
                    // Add vote badge
                    let badge = zone.querySelector('.vote-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'vote-badge';
                        zone.appendChild(badge);
                    }
                    badge.innerText = `${votesForPos}`;
                } else {
                    // Remove badge if no votes
                    const badge = zone.querySelector('.vote-badge');
                    if (badge) badge.remove();
                }
            }

            if (turnState === 'challenging' && myTeam !== activeTeam && teamId === activeTeam) {
                // CHALLENGER VIEW on ACTIVE TEAM TIMELINE
                if (isActivePlacement) {
                    zone.classList.add('disabled-zone');
                    zone.style.visibility = 'hidden';
                } else if (!currentChallenge) {
                    zone.classList.add('clickable-challenge');
                }
            } else if (turnState === 'playing' && myTeam === activeTeam && teamId === activeTeam) {
                // ACTIVE PLAYER VIEW on OWN TIMELINE
                if (!currentPlacement && currentSongData) {
                    zone.classList.add('clickable-placement');
                }
            }
        });
    });
}

// --- Event Delegation ---
function setupTimelineListeners() {
    ['team1', 'team2'].forEach(teamId => {
        const container = document.getElementById(`${teamId}-timeline`);
        container.addEventListener('click', (e) => {
            // Traverse up to find drop-zone
            const zone = e.target.closest('.drop-zone');
            if (!zone) return;

            const pos = parseInt(zone.dataset.pos);
            console.log(`Click delegated: Team=${teamId}, Pos=${pos}, Turn=${turnState}, MyTeam=${myTeam}`);

            // Interaction Logic using current GLOBAL state

            // 1. Challenge Click
            if (turnState === 'challenging' && myTeam !== activeTeam && teamId === activeTeam) {
                // Prevent clicking the hidden spot (double check)
                if (zone.classList.contains('disabled-zone')) return;

                if (currentChallenge) return showNotification("Wacht", "Er is al een challenge geplaatst.");

                if (!myTeam) return showNotification("Error", "Je zit niet in een team!");
                if (!teamsData[myTeam]) return showNotification("Error", "Team data error.");

                if (teamsData[myTeam].tokens > 0) {
                    handleChallenge(pos);
                } else {
                    showNotification("Geen munten", "Je hebt geen tokens meer!");
                }
            }

            // 2. Placement Click
            else if (turnState === 'playing' && myTeam === activeTeam && teamId === activeTeam) {
                if (!currentPlacement && currentSongData) {
                    handlePlacement(pos);
                }
            }
        });
    });
}

// Initialize delegation once
setupTimelineListeners();



function handlePlacement(pos) {
    const teamSize = teamsData[myTeam]?.players?.length || 1;

    if (teamSize > 1) {
        // Multi-player team: submit vote
        myVote = pos;
        hasVoted = true;
        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'submit-vote',
            data: {
                teamId: myTeam,
                pos: pos
            }
        });
        showNotification("Stem Geregistreerd", `Je hebt gestemd voor positie ${pos + 1}. Wacht op je teamgenoten!`);
        renderTimelines(); // Update to show your vote
    } else {
        // Single player: direct placement
        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'submit-placement',
            data: {
                teamId: myTeam,
                pos: pos
            }
        });
    }
}

// Vote update handler (only received by own team members)
socket.on('vote-update', ({ teamId, votes, voterCount }) => {
    if (teamId !== myTeam) return; // Safety check

    teamVotes = votes;
    const voteCount = Object.keys(votes).length;

    // Update UI
    renderTimelines();

    // Update confirm button
    if (confirmPlacementBtn && myTeam === activeTeam) {
        if (voteCount >= voterCount) {
            // Everyone voted
            confirmPlacementBtn.disabled = false;
            confirmPlacementBtn.innerText = "✅ Bevestig Plaatsing";
        } else {
            confirmPlacementBtn.disabled = true;
            confirmPlacementBtn.innerText = `⏳ ${voteCount}/${voterCount} stemmen...`;
        }
    }
});

// Confirm placement button handler
if (confirmPlacementBtn) {
    confirmPlacementBtn.addEventListener('click', () => {
        if (!myTeam || myTeam !== activeTeam) return;

        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'confirm-placement',
            data: { teamId: myTeam }
        });

        confirmPlacementBtn.disabled = true;
        confirmPlacementBtn.innerText = "⏳ Verwerken...";
    });
}

// Replace alerts/confirms
function handleChallenge(pos) {
    showConfirm("Challenge", "Weet je het zeker? Dit kost je 1 munt.", () => {
        socket.emit('game-action', {
            roomCode: myRoomCode,
            action: 'submit-challenge',
            data: {
                teamId: myTeam,
                pos: pos
            }
        });
    });
}


// --- Admin/Token Logic Re-restored ---
adminBadge.addEventListener('click', () => {
    adminLoginModal.classList.remove('hidden');
    adminPasswordInput.focus();
});

adminLoginCancel.addEventListener('click', () => {
    adminLoginModal.classList.add('hidden');
    adminPasswordInput.value = '';
});

adminLoginBtn.addEventListener('click', () => {
    const password = adminPasswordInput.value;
    socket.emit('admin-login', password);
    adminPasswordInput.value = '';
});

revealBtn.onclick = () => {
    socket.emit('game-action', { roomCode: myRoomCode, action: 'reveal-year' });
    revealBtn.disabled = true;
    revealBtn.innerText = "⏳ Revealing...";
    setTimeout(() => {
        revealBtn.disabled = false;
        revealBtn.innerText = "🔍 Reveal Year";
    }, 2000);
};

// Server response to admin login
socket.on('admin-authenticated', (success) => {
    if (success) {
        adminLoginModal.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        showNotification("Success", "Admin authenticated!");
    }
});

adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') adminLoginBtn.click();
});

closeAdminBtn.addEventListener('click', () => adminPanel.classList.add('hidden'));

targetScoreInput.addEventListener('change', () => {
    if (!isHost) return;
    socket.emit('game-action', { roomCode: myRoomCode, action: 'set-target-score', data: targetScoreInput.value });
});

loadPlaylistBtn.addEventListener('click', () => {
    const url = playlistUrlInput.value.trim();
    if (!url) return showNotification("Fout", "Plak eerst een Spotify URL!");

    if (!myRoomCode) {
        showNotification("Fout", "Maak eerst een party aan (Create Party) voor je een playlist laadt!");
        return;
    }

    loadPlaylistBtn.innerText = "Loading...";
    loadPlaylistBtn.disabled = true;
    socket.emit('game-action', { roomCode: myRoomCode, action: 'fetch-playlist', data: url });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playlistUrlInput.value = btn.dataset.url;
        loadPlaylistBtn.click();
    });
});


// Update fetchNextSong to use adminTracks if available
async function fetchNextSong() {
    console.log("Fetching next song...");
    let retryCount = 0;
    const maxRetries = 10; // Fewer retries of the whole function, we'll loop inside instead

    const isPlayed = (artist, title) => {
        const cleanA = artist.toLowerCase().trim();
        const cleanT = title.toLowerCase().trim();
        return roomHistory.some(h =>
            (h.artist.toLowerCase().trim() === cleanA && h.title.toLowerCase().trim() === cleanT) ||
            (h.title.toLowerCase().trim() === cleanT && cleanA.includes(h.artist.toLowerCase().trim()))
        );
    };

    while (retryCount < maxRetries) {
        if (adminTracks.length > 0) {
            // Pick 5 random tracks from admin list and try them in parallel
            const candidates = [];
            for (let i = 0; i < 5; i++) {
                const track = adminTracks[Math.floor(Math.random() * adminTracks.length)];
                if (!isPlayed(track.artist, track.name)) candidates.push(track);
            }

            if (candidates.length === 0) {
                retryCount++;
                continue;
            }

            try {
                // Fetch all candidates in parallel
                const fetchPromises = candidates.map(track =>
                    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(track.artist + ' ' + track.name)}&media=music&limit=10`)
                        .then(r => r.json())
                        .catch(e => ({ results: [] }))
                );

                const allData = await Promise.all(fetchPromises);

                // Find first valid track across all results
                for (const data of allData) {
                    const results = (data.results || []).filter(t => t.previewUrl);
                    const validTrack = results.find(t => !isPlayed(t.artistName, t.trackName));

                    if (validTrack) {
                        const songData = {
                            title: validTrack.trackName,
                            artist: validTrack.artistName,
                            year: new Date(validTrack.releaseDate).getFullYear(),
                            url: validTrack.previewUrl
                        };
                        console.log("Successfully fetched song (Admin Playlist):", songData.title);
                        socket.emit('game-action', { roomCode: myRoomCode, action: 'play-song', data: songData });
                        return; // Done!
                    }
                }
            } catch (e) {
                console.error("Parallel fetch error:", e);
            }
        } else {
            // Fallback to random genres - more aggressive fetching
            const genres = ['80s music hits', '90s music hits', '00s music hits', 'Top 40 hits', 'Classic Rock hits'];
            const query = genres[Math.floor(Math.random() * genres.length)];

            try {
                console.log("Fetching fallback songs for query:", query);
                const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=200`);
                const data = await response.json();
                const results = data.results.filter(t => t.previewUrl);

                // Fast shuffle and pick
                const validTrack = results.sort(() => 0.5 - Math.random())
                    .find(t => !isPlayed(t.artistName, t.trackName));

                if (validTrack) {
                    const songData = {
                        title: validTrack.trackName,
                        artist: validTrack.artistName,
                        year: new Date(validTrack.releaseDate).getFullYear(),
                        url: validTrack.previewUrl
                    };
                    console.log("Successfully fetched song (Random Logic):", songData.title);
                    socket.emit('game-action', { roomCode: myRoomCode, action: 'play-song', data: songData });
                    return;
                }
            } catch (e) {
                console.error("iTunes random fetch error:", e);
            }
        }

        retryCount++;
    }

    console.error("Could not find a new song after many attempts.");
    showNotification("Fout", "Kon geen nieuw nummer vinden. Probeer het opnieuw.");
}

// --- Debug / State Monitor ---
const debugOverlay = document.createElement('div');
// Styled to fit in admin panel
debugOverlay.style.cssText = "background: rgba(0,0,0,0.5); color: lime; padding: 10px; font-family: monospace; font-size: 11px; margin-top: 20px; border-top: 1px solid #333 text-align: left;";
document.getElementById('admin-panel').appendChild(debugOverlay);

function updateDebugDisplay() {
    debugOverlay.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = 'DEBUG INFO';
    debugOverlay.appendChild(strong);
    debugOverlay.appendChild(document.createElement('br'));

    const lines = [
        `My Name: ${myName}`,
        `My Team: ${myTeam || 'None'}`,
        `Active Team: ${activeTeam}`,
        `Turn State: ${turnState}`,
        `Tokens: ${myTeam ? (teamsData[myTeam]?.tokens || 0) : 'N/A'}`,
        `Song Playing: ${currentSongData ? 'Yes' : 'No'}`,
        `Current Placement: ${currentPlacement ? 'Set' : 'None'}`
    ];

    lines.forEach(line => {
        debugOverlay.appendChild(document.createTextNode(line));
        debugOverlay.appendChild(document.createElement('br'));
    });
}

setInterval(updateDebugDisplay, 1000); // Slower interval since it's hidden
