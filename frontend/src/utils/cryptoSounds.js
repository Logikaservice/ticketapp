// Crypto Notification Sounds
// Generates different sounds for different notification types

class CryptoNotificationSounds {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3; // 30% volume by default
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        localStorage.setItem('crypto_sounds_enabled', enabled);
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        localStorage.setItem('crypto_sounds_volume', this.volume);
    }

    loadSettings() {
        const savedEnabled = localStorage.getItem('crypto_sounds_enabled');
        const savedVolume = localStorage.getItem('crypto_sounds_volume');

        if (savedEnabled !== null) {
            this.enabled = savedEnabled === 'true';
        }
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }
    }

    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled) return;

        this.init();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // 📈 Position Opened - Ascending chime
    positionOpened() {
        if (!this.enabled) return;
        this.playTone(523.25, 0.1); // C5
        setTimeout(() => this.playTone(659.25, 0.1), 100); // E5
        setTimeout(() => this.playTone(783.99, 0.15), 200); // G5
    }

    // 📉 Position Closed with Profit - Success sound
    positionClosedProfit() {
        if (!this.enabled) return;
        this.playTone(523.25, 0.08); // C5
        setTimeout(() => this.playTone(659.25, 0.08), 80); // E5
        setTimeout(() => this.playTone(783.99, 0.08), 160); // G5
        setTimeout(() => this.playTone(1046.50, 0.2), 240); // C6
    }

    // ⚠️ Position Closed with Loss - Warning sound
    positionClosedLoss() {
        if (!this.enabled) return;
        this.playTone(392.00, 0.15); // G4
        setTimeout(() => this.playTone(329.63, 0.2), 150); // E4
    }

    // 🔔 Market Scanner Alert - Gentle ping
    marketScannerAlert() {
        if (!this.enabled) return;
        this.playTone(880.00, 0.1, 'sine'); // A5
        setTimeout(() => this.playTone(1174.66, 0.12, 'sine'), 120); // D6
    }

    // 💰 High Profit Alert - Celebration sound
    highProfitAlert() {
        if (!this.enabled) return;
        this.playTone(523.25, 0.06); // C5
        setTimeout(() => this.playTone(659.25, 0.06), 60); // E5
        setTimeout(() => this.playTone(783.99, 0.06), 120); // G5
        setTimeout(() => this.playTone(1046.50, 0.06), 180); // C6
        setTimeout(() => this.playTone(1318.51, 0.15), 240); // E6
    }

    // ⚠️ Stop Loss Hit - Alert sound
    stopLossAlert() {
        if (!this.enabled) return;
        this.playTone(440.00, 0.1); // A4
        setTimeout(() => this.playTone(440.00, 0.1), 150);
        setTimeout(() => this.playTone(440.00, 0.15), 300);
    }
}

// Create singleton instance
const cryptoSounds = new CryptoNotificationSounds();
cryptoSounds.loadSettings();

export default cryptoSounds;
