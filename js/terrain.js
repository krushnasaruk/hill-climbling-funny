/**
 * Mountain Rush - Procedural Terrain Generation & Parallax
 * Generates continuous hilly terrain, constructs Matter.js static segment colliders,
 * handles memory clean-up, and renders parallax background mountains.
 */
class Terrain {
  constructor() {
    this.segments = []; // Array of active physics segment blocks
    this.points = [];   // Array of {x, y} coordinate points of terrain profile
    
    // Config properties
    this.segmentWidth = 60; // Distance between horizontal terrain points
    this.visibleRangeAhead = 1500; // Generate terrain up to 1500px in front of vehicle
    this.visibleRangeBehind = 600;  // Keep terrain up to 600px behind vehicle
    
    // Physics properties
    this.terrainThickness = 50; // Thickness of the static collider box
  }

  /**
   * Generates y-coordinate for a given x-coordinate using multi-octave trigonometric functions.
   * Flat start zone is provided to allow vehicle landing safely.
   */
  getHeight(x) {
    if (x < 400) {
      return 500; // Flat starting runway
    }

    const relX = x - 400;

    // Difficulty scaling: hills get steeper as the player travels further
    const difficultyScale = 1.0 + Math.min(1.5, relX / 8000);

    // Layer 1: Long rolling hills
    const hillLayer = Math.sin(relX * 0.0004) * 160 * difficultyScale;
    
    // Layer 2: Medium steep valleys
    const valleyLayer = Math.cos(relX * 0.0012) * 80 * difficultyScale;
    
    // Layer 3: High frequency bumpy ground
    const bumpLayer = Math.sin(relX * 0.005) * 22;
    
    // Layer 4: Occasional steep slopes / valleys
    const steepLayer = Math.sin(relX * 0.00015) * Math.cos(relX * 0.0003) * 120 * difficultyScale;

    // Calculate base height (increasing vertical coordinates go downwards in canvas,
    // so we offset by 550 and subtract the wave outputs to raise hills upwards)
    let y = 550 - (hillLayer + valleyLayer + bumpLayer + steepLayer);
    
    // Ensure terrain doesn't go too high (clipping sky) or too low (abyss)
    return Math.max(250, Math.min(900, y));
  }

  /**
   * Procedurally generates background parallax hill heights
   */
  getBackgroundHeight(x, layer) {
    if (layer === 1) { // Close background hills
      return 580 - (Math.sin(x * 0.0003) * 120 + Math.cos(x * 0.0008) * 50);
    } else { // Far background mountains
      return 620 - (Math.sin(x * 0.0001) * 200 + Math.cos(x * 0.00025) * 100);
    }
  }

  /**
   * Monitors car coordinate and adds new segments ahead, removing obsolete ones behind.
   * @param {number} carX - Vehicle's current x-coordinate
   */
  update(carX) {
    const minNeededX = carX - this.visibleRangeBehind;
    const maxNeededX = carX + this.visibleRangeAhead;

    // 1. Generate points and segments ahead
    let currentX = 0;
    if (this.points.length > 0) {
      currentX = this.points[this.points.length - 1].x;
    }

    while (currentX < maxNeededX) {
      const nextX = currentX + this.segmentWidth;
      const nextY = this.getHeight(nextX);
      
      this.points.push({ x: nextX, y: nextY });
      
      // If we have at least 2 points, build a physics body between them
      if (this.points.length > 1) {
        const p1 = this.points[this.points.length - 2];
        const p2 = this.points[this.points.length - 1];
        this.createSegmentCollider(p1, p2);
      }
      
      currentX = nextX;
    }

    // 2. Clean up segments that are far behind the car
    this.cleanup(minNeededX);
  }

  /**
   * Creates a static Matter.js box representing a slice of the terrain
   */
  createSegmentCollider(p1, p2) {
    const { Bodies, Body, Composite } = Matter;
    const cat = physicsManager.COLLISION_CATEGORIES;

    // Calculate midpoint, distance, and slope angle between the points
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Create a static rectangle representing this segment
    // We add +2 to the length to overlap segments slightly, preventing tires from catching seams
    const segmentBody = Bodies.rectangle(midX, midY + this.terrainThickness / 2, distance + 3, this.terrainThickness, {
      isStatic: true,
      collisionFilter: { category: cat.TERRAIN },
      friction: 1.2,
      label: 'terrain_segment',
      render: { visible: false }
    });

    // Rotate to align with slope
    Body.setAngle(segmentBody, angle);

    // Store reference so we can update and eventually remove it
    this.segments.push({
      body: segmentBody,
      p1: p1,
      p2: p2,
      minX: Math.min(p1.x, p2.x),
      maxX: Math.max(p1.x, p2.x)
    });

    // Add to physics world
    Composite.add(physicsManager.world, segmentBody);
  }

  /**
   * Disposes of physics bodies that have scrolled off-screen to the left.
   * @param {number} thresholdX - Minimum X coordinate to keep
   */
  cleanup(thresholdX) {
    const beforeCount = this.segments.length;
    
    // Filter segments
    this.segments = this.segments.filter(segment => {
      if (segment.maxX < thresholdX) {
        // Remove from physics engine
        Matter.Composite.remove(physicsManager.world, segment.body);
        return false;
      }
      return true;
    });

    // Clean up points array as well
    if (this.points.length > 0) {
      this.points = this.points.filter(pt => pt.x >= thresholdX - this.segmentWidth);
    }
  }

  /**
   * Wipes all current segments and coordinates (used for restarts)
   */
  clear() {
    this.segments.forEach(seg => {
      Matter.Composite.remove(physicsManager.world, seg.body);
    });
    this.segments = [];
    this.points = [];
    
    // Generate initial flat runway
    const runwayX = -400;
    for (let x = runwayX; x <= 400; x += this.segmentWidth) {
      this.points.push({ x: x, y: 500 });
    }
    
    for (let i = 0; i < this.points.length - 1; i++) {
      this.createSegmentCollider(this.points[i], this.points[i+1]);
    }
  }

  /**
   * Renders the parallax background layers
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} camX - Camera horizontal offset
   * @param {number} viewWidth - Viewport width
   * @param {number} viewHeight - Viewport height
   */
  renderBackground(ctx, camX, viewWidth, viewHeight) {
    // LAYER 2: Far Background Mountains (Moves slowest: 0.1x speed)
    ctx.save();
    const speedFar = 0.1;
    const startFarX = camX * speedFar;
    ctx.fillStyle = '#141d2f'; // Deep midnight blue-grey
    ctx.beginPath();
    ctx.moveTo(0, viewHeight);
    
    // Plot points across the width of canvas
    const sampleStep = 40;
    for (let screenX = 0; screenX <= viewWidth; screenX += sampleStep) {
      // Map screenX back to world coordinates using camera parallax offset
      const worldX = (camX - viewWidth/2) * speedFar + screenX;
      const mountainY = this.getBackgroundHeight(worldX, 2);
      ctx.lineTo(screenX, mountainY);
    }
    ctx.lineTo(viewWidth, viewHeight);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // LAYER 1: Close Background Hills (Moves faster: 0.3x speed)
    ctx.save();
    const speedClose = 0.3;
    const startCloseX = camX * speedClose;
    
    // Foreground/midground mountains gradient
    const hillGrad = ctx.createLinearGradient(0, 300, 0, viewHeight);
    hillGrad.addColorStop(0, '#1a263e'); // Lighter mid-blue
    hillGrad.addColorStop(1, '#0e1524');
    
    ctx.fillStyle = hillGrad;
    ctx.beginPath();
    ctx.moveTo(0, viewHeight);
    
    for (let screenX = 0; screenX <= viewWidth; screenX += sampleStep) {
      const worldX = (camX - viewWidth/2) * speedClose + screenX;
      const mountainY = this.getBackgroundHeight(worldX, 1);
      ctx.lineTo(screenX, mountainY);
    }
    ctx.lineTo(viewWidth, viewHeight);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renders the main foreground hills with glowing neon path
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} viewHeight - Viewport height (used to fill gradients)
   */
  renderForeground(ctx, viewHeight) {
    if (this.points.length === 0) return;

    ctx.save();
    
    // Create hill fill gradient
    const terrainGrad = ctx.createLinearGradient(0, 300, 0, viewHeight + 300);
    terrainGrad.addColorStop(0, '#102a43'); // Cool deep teal
    terrainGrad.addColorStop(0.5, '#0b1b2d'); // Dark blue
    terrainGrad.addColorStop(1, '#060d17'); // Pitch dark at bottom

    ctx.beginPath();
    // Start drawing from first loaded point
    ctx.moveTo(this.points[0].x, viewHeight + 300);
    
    this.points.forEach(pt => {
      ctx.lineTo(pt.x, pt.y);
    });

    // Close path to fill the ground
    ctx.lineTo(this.points[this.points.length - 1].x, viewHeight + 300);
    ctx.closePath();
    
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // Draw Glowing Neon Track Edge
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#10b981'; // Neon green track
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.restore();
  }
}

// Export instance globally
window.terrainManager = new Terrain();
