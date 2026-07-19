/**
 * Mountain Rush - Game Core Orchestrator
 * Controls game states, main loops, inputs, camera tracking, dust particle simulation, and UI sync.
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Game States
    this.STATES = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
    this.currentState = this.STATES.MENU;
    
    // Core Game Objects
    this.vehicle = null;
    
    // Game Stats
    this.stats = {
      distance: 0,
      coins: 0,
      fuel: 100, // 0 to 100 percentage
      speed: 0
    };
    
    // Input state tracking
    this.inputs = {
      gas: false,
      brake: false
    };
    
    // Camera follow properties
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetZoom: 1.0
    };
    
    // Particle system (wheel dust kickup)
    this.particles = [];
    
    // Timing properties
    this.lastTime = 0;
    this.startPosX = 150; // Starting vehicle X
    this.startPosY = 420; // Starting vehicle Y
    
    // Wheel contact states (for airborne checks)
    this.rearWheelTouching = false;
    this.frontWheelTouching = false;

    // DOM References
    this.dom = {
      menu: document.getElementById('main-menu'),
      gameOver: document.getElementById('game-over'),
      gameOverTitle: document.getElementById('game-over-title'),
      gameOverReason: document.getElementById('game-over-reason'),
      hud: document.getElementById('hud'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      muteBtn: document.getElementById('mute-btn'),
      muteIconPath: document.getElementById('mute-icon-path'),
      mobileControls: document.getElementById('mobile-controls'),
      distanceVal: document.getElementById('distance-val'),
      coinsVal: document.getElementById('coins-val'),
      fuelBar: document.getElementById('fuel-bar-inner'),
      speedVal: document.getElementById('speed-val'),
      finalDistance: document.getElementById('final-distance'),
      finalCoins: document.getElementById('final-coins'),
      btnGas: document.getElementById('btn-gas'),
      btnBrake: document.getElementById('btn-brake')
    };
  }

  /**
   * Initializes screen settings, bindings, and physics
   */
  init() {
    // 1. Initialize Canvas Size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // 2. Initialize Physics Manager
    physicsManager.init();

    // 3. Register Event Listeners
    this.bindEvents();

    // 4. Setup Collision Listeners in Matter.js
    this.setupCollisions();

    // 5. Run initial loop to render background menu scene
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  /**
   * Resizes canvas to fill browser viewport, adapting resolution
   */
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Binds keyboard, mobile touch, and overlay UI buttons
   */
  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (this.currentState !== this.STATES.PLAYING) return;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        this.inputs.gas = true;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        this.inputs.brake = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        this.inputs.gas = false;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        this.inputs.brake = false;
      }
    });

    // Prevent scrolling or double-tap zooming on iOS safari
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Mobile touch buttons (Gas)
    this.dom.btnGas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.inputs.gas = true;
      audioManager.init(); // Initialize audio on first tap
    });
    this.dom.btnGas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.inputs.gas = false;
    });

    // Mobile touch buttons (Brake)
    this.dom.btnBrake.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.inputs.brake = true;
      audioManager.init(); // Initialize audio on first tap
    });
    this.dom.btnBrake.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.inputs.brake = false;
    });

    // Menu start buttons
    this.dom.startBtn.addEventListener('click', () => {
      audioManager.init();
      this.startGame();
    });

    this.dom.restartBtn.addEventListener('click', () => {
      this.startGame();
    });

    // Sound toggle
    this.dom.muteBtn.addEventListener('click', () => {
      const isMuted = audioManager.toggleMute();
      
      // Update SVG path for mute icon
      if (isMuted) {
        this.dom.muteIconPath.setAttribute('d', 'M3.64,2.27L2.27,3.64L7.64,9H3V15H7L12,20V13.36L16.25,17.61C15.6,18.06 14.86,18.4 14,18.57V20.63C15.4,20.4 16.71,19.78 17.76,18.88L20.36,21.48L21.73,20.11L3.64,2.27M12,4L9.91,6.09L12,8.18V4M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.48,12.43 16.5,12.22 16.5,12M19,12C19,13.29 18.66,14.5 18.07,15.56L19.58,17.07C20.47,15.58 21,13.85 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12Z');
      } else {
        this.dom.muteIconPath.setAttribute('d', 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z');
      }
    });
  }

  /**
   * Sets up collision events in Matter.js to detect vehicle wrecks (driver head hitting ground)
   * and tracking wheel contacts for airborne logic.
   */
  setupCollisions() {
    const { Events } = Matter;

    // Detect collision starts (driver head wreck)
    Events.on(physicsManager.engine, 'collisionStart', (event) => {
      if (this.currentState !== this.STATES.PLAYING) return;
      
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const labelA = pair.bodyA.label;
        const labelB = pair.bodyB.label;

        // Check if driver head collides with terrain segments
        if ((labelA === 'driver_head' && labelB === 'terrain_segment') ||
            (labelB === 'driver_head' && labelA === 'terrain_segment')) {
          this.triggerGameOver('VEHICLE FLIPPED', "Your driver's neck snapped!");
          return;
        }
      }
    });

    // Continuously check wheel contacts during physics steps
    Events.on(physicsManager.engine, 'collisionActive', (event) => {
      if (this.currentState !== this.STATES.PLAYING || !this.vehicle) return;

      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        
        // Check if rear wheel is touching ground
        if (pair.bodyA === this.vehicle.rearWheel || pair.bodyB === this.vehicle.rearWheel) {
          this.rearWheelTouching = true;
        }
        // Check if front wheel is touching ground
        if (pair.bodyA === this.vehicle.frontWheel || pair.bodyB === this.vehicle.frontWheel) {
          this.frontWheelTouching = true;
        }
      }
    });
  }

  /**
   * Resets scores, physics world, regenerates terrain, spawns car, and begins play
   */
  startGame() {
    // 1. Hide Menus, Show HUD
    this.dom.menu.classList.add('hidden');
    this.dom.gameOver.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    
    // Detect mobile browser to toggle onscreen pedals
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
      this.dom.mobileControls.classList.remove('hidden');
    }

    // 2. Reset Stats
    this.stats.distance = 0;
    this.stats.coins = 0;
    this.stats.fuel = 100;
    this.stats.speed = 0;
    
    this.inputs.gas = false;
    this.inputs.brake = false;
    
    this.particles = [];

    // 3. Reset Physics World
    physicsManager.clearWorld();

    // 4. Reset Managers
    terrainManager.clear();
    collectiblesManager.clear();

    // 5. Create Vehicle
    this.vehicle = new Vehicle(this.startPosX, this.startPosY);

    // 6. Reset Camera
    this.camera.x = this.startPosX;
    this.camera.y = this.startPosY;
    this.camera.zoom = 1.0;
    this.camera.targetZoom = 1.0;

    // 7. Start Sound Synthesis
    audioManager.startEngine();

    // 8. Swap State
    this.currentState = this.STATES.PLAYING;
    console.log("Game started.");
  }

  /**
   * Wrecks the vehicle and halts gameplay
   * @param {string} title - Header error (e.g. OUT OF FUEL, VEHICLE CRASHED)
   * @param {string} reason - Detailed subtitle
   */
  triggerGameOver(title, reason) {
    if (this.currentState === this.STATES.GAMEOVER) return;

    this.currentState = this.STATES.GAMEOVER;
    audioManager.stopEngine();
    audioManager.playCrash();

    // Populate Game Over Overlay
    this.dom.gameOverTitle.innerText = title;
    this.dom.gameOverReason.innerText = reason;
    this.dom.finalDistance.innerText = `${this.stats.distance} m`;
    this.dom.finalCoins.innerText = this.stats.coins;

    // Swap Overlays
    this.dom.hud.classList.add('hidden');
    this.dom.mobileControls.classList.add('hidden');
    this.dom.gameOver.classList.remove('hidden');
  }

  /**
   * Spawns dust particles behind the rear wheel when accelerating on the ground
   */
  spawnDust() {
    if (!this.vehicle || !this.rearWheelTouching) return;

    const rearPos = this.vehicle.rearWheel.position;
    const count = 2;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: rearPos.x - 15,
        y: rearPos.y + this.vehicle.wheelRadius * 0.9,
        vx: -2 - Math.random() * 3, // Fly backwards
        vy: -0.5 - Math.random() * 2, // Fly slightly upwards
        size: 3 + Math.random() * 5,
        alpha: 0.8,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.04
      });
    }
  }

  /**
   * Updates coordinates, velocities, and alphas of dynamic particles
   */
  updateParticles(dtRatio) {
    this.particles.forEach(p => {
      p.x += p.vx * dtRatio;
      p.y += p.vy * dtRatio;
      p.life -= p.decay * dtRatio;
      p.alpha = Math.max(0, p.life);
    });

    // Remove expired particles
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /**
   * Main game loop, utilizing variable deltaTime
   */
  loop(time) {
    // Calculate Delta Time in ms, converting to standardized 60fps frame multiplier
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    const dtRatio = Math.max(0.1, Math.min(3, deltaTime / 16.666));

    // 1. UPDATE STATE LOGIC
    if (this.currentState === this.STATES.PLAYING) {
      this.updatePlayingState(deltaTime, dtRatio);
    } else {
      // Menu scene logic (simple ambient scroll)
      this.camera.x += 1.5 * dtRatio;
      terrainManager.update(this.camera.x);
    }

    // 2. RENDERING LOGIC
    this.render();

    // 3. REQUEST NEXT FRAME
    requestAnimationFrame((time) => this.loop(time));
  }

  /**
   * Updates physics, driving force inputs, collectibles, camera tracker, and HUD stats
   */
  updatePlayingState(deltaTime, dtRatio) {
    // Reset touching sensors (set back to true in physics collision callback if touching)
    this.rearWheelTouching = false;
    this.frontWheelTouching = false;

    // Run Matter.js physics step
    physicsManager.update(deltaTime);

    // Set vehicle airborne state based on results of the physics frame
    const touching = this.rearWheelTouching || this.frontWheelTouching;
    this.vehicle.updateAirborneState(touching);

    // Apply inputs (Throttle / Brake / Air balance)
    if (this.inputs.gas) {
      this.vehicle.accelerate();
      this.spawnDust(); // Kick up dust on the ground
    }
    if (this.inputs.brake) {
      this.vehicle.brake();
    }

    // Update Particles
    this.updateParticles(dtRatio);

    // Procedural terrain: generate chunk ahead of car, clean up behind
    const carX = this.vehicle.chassis.position.x;
    const carY = this.vehicle.chassis.position.y;
    terrainManager.update(carX);

    // Check if new points were added to spawn collectibles
    const latestPoints = terrainManager.points;
    if (latestPoints.length > 0) {
      const lastPt = latestPoints[latestPoints.length - 1];
      // CollectiblesManager spawns items along newly generated profile
      collectiblesManager.spawnCheck(lastPt.x, lastPt.y);
    }

    // Check coin/fuel collisions with vehicle
    collectiblesManager.checkCollisions(this.vehicle, this.stats);
    // Cleanup collectibles scrolled off-screen
    collectiblesManager.cleanup(carX - 800);

    // Deplete Fuel: faster rate when gas pedaling, slower at idle
    const fuelRate = this.inputs.gas ? 0.08 : 0.035;
    this.stats.fuel = Math.max(0, this.stats.fuel - fuelRate * dtRatio);

    if (this.stats.fuel <= 0) {
      this.triggerGameOver('OUT OF FUEL', 'You ran dry in the wilderness!');
      return;
    }

    // Detect falling into deep abyss
    if (carY > 1050) {
      this.triggerGameOver('PLUMMETED', 'You plunged into the valley!');
      return;
    }

    // Update score metrics
    const currentDist = Math.max(0, Math.round((carX - this.startPosX) / 10));
    this.stats.distance = Math.max(this.stats.distance, currentDist);
    this.stats.speed = this.vehicle.getSpeedKmH();

    // Update synthesized engine sounds based on throttle and velocity
    const speedRatio = Math.min(1.0, Math.abs(this.vehicle.chassis.velocity.x) / 12);
    const revving = this.inputs.gas || this.inputs.brake;
    audioManager.updateEngine(speedRatio, revving);

    // Camera tracker smooth follow (lerp)
    // Place car slightly left (0.15 * width) to see hills ahead
    const targetCamX = carX + window.innerWidth * 0.15;
    const targetCamY = carY - 20;

    this.camera.x += (targetCamX - this.camera.x) * 0.08 * dtRatio;
    this.camera.y += (targetCamY - this.camera.y) * 0.08 * dtRatio;

    // Camera dynamic zoom (zoom out as velocity increases)
    const currentSpeed = Math.abs(this.vehicle.chassis.velocity.x);
    this.camera.targetZoom = Math.max(0.72, 1.0 - (currentSpeed * 0.018));
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.05 * dtRatio;

    // Sync HUD displays
    this.syncHUD();
  }

  /**
   * Synchronizes HUD dashboard elements with current game statistics
   */
  syncHUD() {
    this.dom.distanceVal.innerText = `${this.stats.distance} m`;
    this.dom.coinsVal.innerText = this.stats.coins;
    
    // Sync Fuel indicator with warnings
    const fuelPercent = this.stats.fuel;
    this.dom.fuelBar.style.width = `${fuelPercent}%`;
    
    if (fuelPercent < 25) {
      this.dom.fuelBar.classList.add('fuel-low');
    } else {
      this.dom.fuelBar.classList.remove('fuel-low');
    }

    // Sync speedometer dial text
    this.dom.speedVal.innerText = this.stats.speed;
  }

  /**
   * Clears context and renders all background, parallax, foreground terrain, particles, and car.
   */
  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear with gradient night sky
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#040712'); // Pitch black space
    skyGrad.addColorStop(0.6, '#0b0f19'); // Dark midnight blue
    skyGrad.addColorStop(1, '#1e293b'); // Dark blue-grey above horizon
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Draw Parallax Background layers
    terrainManager.renderBackground(this.ctx, this.camera.x, w, h);

    // 3. Render camera space objects (foreground terrain, car, particles, coins)
    this.ctx.save();
    
    // Apply camera offsets (centered around window size)
    this.ctx.translate(w / 2, h / 2);
    // Apply dynamic camera zoom
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    // Translate to current coordinates
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw main ground track
    terrainManager.renderForeground(this.ctx, h);

    // Draw coins and fuel drums
    collectiblesManager.render(this.ctx, this.camera.x, w / this.camera.zoom);

    // Draw dynamic particles (wheel smoke/dust)
    this.particles.forEach(p => {
      this.ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha})`; // White/grey dust
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw Vehicle (if playing)
    if (this.currentState === this.STATES.PLAYING && this.vehicle) {
      this.vehicle.render(this.ctx);
    }

    this.ctx.restore();
  }
}

// Instantiate and start game orchestrator
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
