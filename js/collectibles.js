/**
 * Mountain Rush - Collectibles (Coins and Fuel Canisters)
 * Spawns items along the terrain profile, checks mathematical collisions with the vehicle,
 * and renders animated vector assets.
 */
class CollectiblesManager {
  constructor() {
    this.items = [];
    
    // Spawning controls to prevent bunching
    this.lastFuelX = 200; // X position of the last spawned fuel
    this.fuelInterval = 700; // Fuel canister spawned roughly every 700px
    this.coinFrequency = 0.15; // 15% chance to spawn a coin on a terrain point
    
    this.coinRadius = 12;
    this.fuelSize = 20; // Fuel box dimensions
    this.spinAngle = 0;  // Angle used for the 3D-like spinning coin animation
  }

  /**
   * Spawns coins and fuel canisters dynamically based on newly generated terrain points.
   * @param {number} x - Terrain point X
   * @param {number} y - Terrain point Y
   */
  spawnCheck(x, y) {
    // Avoid spawning near starting runway
    if (x < 600) return;

    // 1. Check fuel canister spawning (placed periodically on flat-ish areas)
    if (x - this.lastFuelX > this.fuelInterval) {
      this.items.push({
        type: 'fuel',
        x: x,
        y: y - 35, // Positioned slightly above ground
        width: this.fuelSize,
        height: this.fuelSize * 1.3,
        collected: false
      });
      this.lastFuelX = x;
      return; // Skip coin spawning if fuel is spawned
    }

    // 2. Check coin spawning (spawns in arcs or chains on top of hills)
    if (Math.random() < this.coinFrequency) {
      // Spawn a mini cluster of 3 coins following the slope
      const count = 3;
      const spacing = 35;
      for (let i = 0; i < count; i++) {
        const coinX = x + (i * spacing);
        const coinY = terrainManager.getHeight(coinX) - 30;
        
        this.items.push({
          type: 'coin',
          x: coinX,
          y: coinY,
          radius: this.coinRadius,
          collected: false
        });
      }
    }
  }

  /**
   * Checks collisions between vehicle parts and collectibles.
   * @param {Vehicle} vehicle - Player's vehicle instance
   * @param {Object} gameStats - Object containing coin score and fuel status
   */
  checkCollisions(vehicle, gameStats) {
    if (!vehicle || !vehicle.chassis) return;

    const chassisPos = vehicle.chassis.position;
    const frontPos = vehicle.frontWheel.position;
    const rearPos = vehicle.rearWheel.position;

    // Radius to check (combines car parts sizes with items sizes)
    const collectThreshold = 45;

    this.items.forEach(item => {
      if (item.collected) return;

      // Check distance from item to: Chassis, Front Wheel, or Rear Wheel
      const distChassis = Math.hypot(item.x - chassisPos.x, item.y - chassisPos.y);
      const distFront = Math.hypot(item.x - frontPos.x, item.y - frontPos.y);
      const distRear = Math.hypot(item.x - rearPos.x, item.y - rearPos.y);

      // If close enough to any part, trigger collection
      if (distChassis < collectThreshold || distFront < collectThreshold || distRear < collectThreshold) {
        item.collected = true;
        
        if (item.type === 'coin') {
          gameStats.coins += 1;
          audioManager.playCoin();
        } else if (item.type === 'fuel') {
          gameStats.fuel = 100; // Refill tank
          audioManager.playFuel();
        }
      }
    });

    // Remove collected items from array
    this.items = this.items.filter(item => !item.collected);
  }

  /**
   * Cleans up collectibles that are left far behind to free memory.
   * @param {number} minX - Minimum X coordinate to keep
   */
  cleanup(minX) {
    this.items = this.items.filter(item => item.x >= minX);
  }

  /**
   * Wipes all collectibles on restart
   */
  clear() {
    this.items = [];
    this.lastFuelX = 200;
  }

  /**
   * Renders the visible collectibles with custom vectors and animations
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX - Camera X coordinate
   * @param {number} viewWidth - Canvas viewport width
   */
  render(ctx, camX, viewWidth) {
    // Increment spinning coin angle
    this.spinAngle += 0.08;

    const leftBoundary = camX - viewWidth / 2 - 100;
    const rightBoundary = camX + viewWidth / 2 + 100;

    this.items.forEach(item => {
      // Frustum culling: only draw items that are currently in the camera view
      if (item.x < leftBoundary || item.x > rightBoundary) return;

      if (item.type === 'coin') {
        this.drawCoin(ctx, item);
      } else if (item.type === 'fuel') {
        this.drawFuelCanister(ctx, item);
      }
    });
  }

  /**
   * Renders a glowing, 3D rotating gold coin
   */
  drawCoin(ctx, coin) {
    ctx.save();
    ctx.translate(coin.x, coin.y);

    // Dynamic scale width to simulate 3D rotation
    const rotationScale = Math.sin(this.spinAngle);
    ctx.scale(Math.abs(rotationScale), 1);

    // Glowing shadow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fbbf24';

    // Outer edge
    ctx.beginPath();
    ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; // Yellow-gold
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#d97706'; // Dark orange-gold border
    ctx.stroke();

    // Inner detail circle
    ctx.beginPath();
    ctx.arc(0, 0, coin.radius * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Embossed inner symbol "$" or "C" (simplified lines for scaling)
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -coin.radius * 0.45);
    ctx.lineTo(0, coin.radius * 0.45);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders a red metallic Jerrycan for Fuel
   */
  drawFuelCanister(ctx, fuel) {
    ctx.save();
    ctx.translate(fuel.x, fuel.y);

    // Glow effect
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ef4444'; // Red glow

    // 1. Canister body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-fuel.width / 2, -fuel.height / 2, fuel.width, fuel.height, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 2. Canister handle (top loop)
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.rect(-fuel.width / 3, -fuel.height / 2 - 5, fuel.width / 1.5, 6);
    ctx.fill();
    ctx.stroke();

    // 3. Spout / nozzle cap (top left angle)
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.moveTo(-fuel.width / 2 + 3, -fuel.height / 2);
    ctx.lineTo(-fuel.width / 2, -fuel.height / 2 - 8);
    ctx.lineTo(-fuel.width / 2 + 8, -fuel.height / 2 - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Jerrycan embossed cross detail
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-fuel.width / 3, -fuel.height / 3);
    ctx.lineTo(fuel.width / 3, fuel.height / 3);
    ctx.moveTo(fuel.width / 3, -fuel.height / 3);
    ctx.lineTo(-fuel.width / 3, fuel.height / 3);
    ctx.stroke();

    // 5. Text Label "GAS" or "FUEL"
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-hud');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAS', 0, 0);

    ctx.restore();
  }
}

// Export instance globally
window.collectiblesManager = new CollectiblesManager();
