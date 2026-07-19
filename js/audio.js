/**
 * Mountain Rush - Web Audio Synthesizer
 * Generates all game sound effects dynamically without external asset files.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    
    // Engine sound nodes
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    
    this.initialized = false;
  }

  /**
   * Initializes the AudioContext. Must be called after a user gesture.
   */
  init() {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.initialized = true;
      console.log("AudioContext initialized successfully.");
    } catch (e) {
      console.error("Web Audio API not supported in this browser:", e);
    }
  }

  /**
   * Resumes AudioContext if suspended (browser security autoplays policy)
   */
  async resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Starts the continuous engine hum sound
   */
  startEngine() {
    if (!this.initialized || this.muted) return;
    this.resumeContext();

    if (this.engineOsc) return; // Already running

    try {
      // Create oscillator (sawtooth wave gives a nice gritty motor sound)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // Idle frequency

      // Filter to cut out harsh highs
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(180, this.ctx.currentTime);

      // Gain node to control engine volume
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      // Fade in the engine sound
      this.engineGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.5);

      // Connect nodes
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start(0);
    } catch (e) {
      console.error("Failed to start engine audio:", e);
    }
  }

  /**
   * Updates engine pitch and volume based on vehicle velocity
   * @param {number} speedRatio - Normalized speed (0 to 1)
   * @param {boolean} throttleActive - Is the player actively pressing gas/brake
   */
  updateEngine(speedRatio, throttleActive) {
    if (!this.initialized || this.muted || !this.engineOsc) return;

    const now = this.ctx.currentTime;
    
    // Pitch: Base idle 45Hz, shifts up to 220Hz at max speed.
    // Give a little boost if gas pedal is pressed
    const targetFreq = 45 + (speedRatio * 140) + (throttleActive ? 35 : 0);
    
    // Smooth transition to avoid clicking sounds
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
    
    // Filter sweep: Opens up filter as pitch goes up
    const filterFreq = 180 + (speedRatio * 400);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.1);
    
    // Volume adjustments: Louder when revving
    const targetGain = throttleActive ? 0.35 : 0.18;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  /**
   * Fades out and stops the engine sound
   */
  stopEngine() {
    if (!this.engineOsc) return;

    try {
      const now = this.ctx.currentTime;
      this.engineGain.gain.cancelScheduledValues(now);
      this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
      this.engineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      const osc = this.engineOsc;
      this.engineOsc = null;

      setTimeout(() => {
        if (!this.engineOsc) { // Double check we didn't restart
          try {
            osc.stop();
            osc.disconnect();
          } catch(err) {}
        }
      }, 350);
    } catch (e) {
      console.warn("Error stopping engine sound:", e);
    }
  }

  /**
   * Plays a classic 8-bit double-tone coin collect ding
   */
  playCoin() {
    if (!this.initialized || this.muted) return;
    this.resumeContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Arpeggio: start at 880Hz (A5), jump to 1320Hz (E6) quickly
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * Plays an upward fluid sound for fuel refills
   */
  playFuel() {
    if (!this.initialized || this.muted) return;
    this.resumeContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Frequency sweep upwards
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.25);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Plays a low bassy crash/wreck sound
   */
  playCrash() {
    if (!this.initialized || this.muted) return;
    this.resumeContext();

    const now = this.ctx.currentTime;
    
    // Create a low thud sound using a triangle oscillator sweeping downwards
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.Q.setValueAtTime(8, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.75);
  }

  /**
   * Toggles the mute state of the audio system
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
    } else {
      if (this.initialized) {
        this.startEngine();
      }
    }
    return this.muted;
  }
}

// Global single instance export
window.audioManager = new AudioManager();
