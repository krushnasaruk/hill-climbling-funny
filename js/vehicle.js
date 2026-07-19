/**
 * Mountain Rush - Vehicle Physics and Rendering
 * Handles the creation of the car, suspension springs, wheel forces, air tilting, and rendering.
 */
class Vehicle {
  constructor(x, y) {
    this.initialX = x;
    this.initialY = y;

    // Vehicle specifications
    this.chassisWidth = 110;
    this.chassisHeight = 22;
    this.wheelRadius = 24;
    
    // Physics properties
    this.maxWheelSpeed = 0.45; // Max angular velocity forward (rad/s)
    this.maxWheelSpeedBack = 0.25; // Max angular velocity reverse
    this.acceleration = 0.018; // Speed increment per frame
    this.brakingForce = 0.04;  // Speed decrement on brake
    this.tiltForce = 0.09;    // Torque applied for air balance control
    
    // Core physics bodies
    this.chassis = null;
    this.frontWheel = null;
    this.rearWheel = null;
    this.driverHead = null;
    
    // Suspension constraints
    this.suspensionConstraints = [];
    
    // Control states
    this.isAirborne = false;

    this.createPhysicsBody(x, y);
  }

  /**
   * Creates the vehicle physics parts and links them with spring constraints.
   */
  createPhysicsBody(x, y) {
    const { Bodies, Body, Composite, Constraint } = Matter;
    const cat = physicsManager.COLLISION_CATEGORIES;

    // 1. Create Chassis Body (compound body including cabin and head)
    const chassisPart = Bodies.rectangle(x, y, this.chassisWidth, this.chassisHeight, {
      collisionFilter: { category: cat.VEHICLE_CHASSIS },
      density: 0.002,
      friction: 0.2,
      label: 'chassis_main',
      render: { visible: false }
    });

    // Cockpit cabin (aesthetic and buffer)
    const cabinPart = Bodies.polygon(x - 5, y - 22, 3, 28, {
      collisionFilter: { category: cat.VEHICLE_CHASSIS },
      density: 0.001,
      label: 'chassis_cabin',
      render: { visible: false }
    });
    // Rotate cabin slightly for sporty look
    Body.rotate(cabinPart, Math.PI / 6);

    // Driver's Head - acts as a game-over trigger if it touches terrain
    this.driverHead = Bodies.circle(x - 5, y - 40, 11, {
      collisionFilter: {
        category: cat.DRIVER_HEAD,
        mask: cat.TERRAIN // ONLY collides with terrain to detect wreck
      },
      density: 0.0005,
      label: 'driver_head',
      render: { visible: false }
    });

    // Assemble into compound body
    this.chassis = Body.create({
      parts: [chassisPart, cabinPart, this.driverHead],
      label: 'vehicle_chassis',
      // Give car a low center of gravity so it naturally stabilizes
      centreOfMass: { x: -5, y: 5 }
    });

    // 2. Create Wheels
    const wheelOptions = {
      collisionFilter: {
        category: cat.VEHICLE_WHEEL,
        mask: cat.TERRAIN // Wheels only collide with the ground
      },
      friction: 1.4, // Super high friction for climbing
      density: 0.003,
      restitution: 0.15, // Low bounce for stability
      label: 'wheel'
    };

    this.rearWheel = Bodies.circle(x - this.chassisWidth / 2.2, y + 20, this.wheelRadius, wheelOptions);
    this.frontWheel = Bodies.circle(x + this.chassisWidth / 2.2, y + 20, this.wheelRadius, wheelOptions);

    // 3. Create Suspension (Spring Constraints)
    // To make a stable suspension that doesn't twist, we connect each wheel with two spring constraints
    // forming a flexible triangle.
    const suspensionStiffness = 0.07;
    const suspensionDamping = 0.15;

    // Rear wheel springs
    const rearSpring1 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: -this.chassisWidth / 2.2, y: 10 },
      bodyB: this.rearWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspensionStiffness,
      damping: suspensionDamping,
      length: 22
    });

    const rearSpring2 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: -this.chassisWidth / 5, y: 0 },
      bodyB: this.rearWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspensionStiffness,
      damping: suspensionDamping,
      length: 38
    });

    // Front wheel springs
    const frontSpring1 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: this.chassisWidth / 2.2, y: 10 },
      bodyB: this.frontWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspensionStiffness,
      damping: suspensionDamping,
      length: 22
    });

    const frontSpring2 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: this.chassisWidth / 5, y: 0 },
      bodyB: this.frontWheel,
      pointB: { x: 0, y: 0 },
      stiffness: suspensionStiffness,
      damping: suspensionDamping,
      length: 38
    });

    this.suspensionConstraints = [rearSpring1, rearSpring2, frontSpring1, frontSpring2];

    // Add all to Matter World
    Composite.add(physicsManager.world, [
      this.chassis,
      this.rearWheel,
      this.frontWheel,
      ...this.suspensionConstraints
    ]);
  }

  /**
   * Applies gas throttle forces to both wheels (All-Wheel Drive for steep climbs)
   */
  accelerate() {
    // Spin wheels forward
    const rearSpeed = this.rearWheel.angularVelocity;
    const frontSpeed = this.frontWheel.angularVelocity;

    if (rearSpeed < this.maxWheelSpeed) {
      Matter.Body.setAngularVelocity(this.rearWheel, Math.min(this.maxWheelSpeed, rearSpeed + this.acceleration));
    }
    if (frontSpeed < this.maxWheelSpeed) {
      Matter.Body.setAngularVelocity(this.frontWheel, Math.min(this.maxWheelSpeed, frontSpeed + this.acceleration));
    }

    // Apply pitch rotation torque to chassis if in the air (clockwise / tilt back)
    if (this.isAirborne) {
      Matter.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity + this.tiltForce * 0.15);
    }
  }

  /**
   * Applies braking forces (rapid deceleration) or reverse throttle
   */
  brake() {
    const rearSpeed = this.rearWheel.angularVelocity;
    const frontSpeed = this.frontWheel.angularVelocity;

    // If moving forward, apply brakes
    if (rearSpeed > 0.05) {
      Matter.Body.setAngularVelocity(this.rearWheel, Math.max(0, rearSpeed - this.brakingForce));
      Matter.Body.setAngularVelocity(this.frontWheel, Math.max(0, frontSpeed - this.brakingForce));
    } else {
      // Otherwise, reverse wheels
      if (rearSpeed > -this.maxWheelSpeedBack) {
        Matter.Body.setAngularVelocity(this.rearWheel, Math.max(-this.maxWheelSpeedBack, rearSpeed - this.acceleration));
      }
      if (frontSpeed > -this.maxWheelSpeedBack) {
        Matter.Body.setAngularVelocity(this.frontWheel, Math.max(-this.maxWheelSpeedBack, frontSpeed - this.acceleration));
      }
    }

    // Apply pitch rotation torque to chassis if in the air (counter-clockwise / tilt forward)
    if (this.isAirborne) {
      Matter.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity - this.tiltForce * 0.15);
    }
  }

  /**
   * Detects if the vehicle is in the air by casting checks or analyzing contact
   * For simplicity and high performance, we check wheel distances to terrain or contact points.
   * If both wheels are off the ground, the vehicle is airborne.
   * @param {boolean} wheelsTouching - State passed from game engine collision solver
   */
  updateAirborneState(wheelsTouching) {
    this.isAirborne = !wheelsTouching;
  }

  /**
   * Gets current forward speed (using chassis velocity along X axis)
   */
  getSpeedKmH() {
    if (!this.chassis) return 0;
    const speed = this.chassis.velocity.x;
    // Map speed to user-friendly dashboard values (e.g. max ~ 120 km/h)
    return Math.max(0, Math.round(speed * 4.5));
  }

  /**
   * Renders the car and all its parts onto the canvas context
   * @param {CanvasRenderingContext2D} ctx - HTML5 Canvas 2D Context
   */
  render(ctx) {
    // 1. Draw Shock Absorbers (Suspension Coil Springs)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9ca3af'; // Metallic grey
    
    this.suspensionConstraints.forEach(constraint => {
      // Find current positions of endpoints in world space
      const posA = Matter.Constraint.pointAWorld(constraint);
      const posB = Matter.Constraint.pointBWorld(constraint);
      
      // Draw a spiral coil line representing a physical spring
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.hypot(dx, dy);
      const steps = 8;
      
      // Draw coil zig-zags
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = posA.x + dx * t;
        const y = posA.y + dy * t;
        
        if (i > 1 && i < steps) {
          // Offset perpendicular to create the coil shape
          const perpX = -dy / dist;
          const perpY = dx / dist;
          const amplitude = 8 * (i % 2 === 0 ? 1 : -1);
          ctx.lineTo(x + perpX * amplitude, y + perpY * amplitude);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // 2. Draw Chassis
    ctx.save();
    ctx.translate(this.chassis.position.x, this.chassis.position.y);
    ctx.rotate(this.chassis.angle);

    // Chassis body gradient (Futuristic glowing look)
    const bodyGrad = ctx.createLinearGradient(-this.chassisWidth/2, 0, this.chassisWidth/2, 0);
    bodyGrad.addColorStop(0, '#1e3a8a'); // Deep blue
    bodyGrad.addColorStop(0.5, '#3b82f6'); // Cyber blue
    bodyGrad.addColorStop(1, '#60a5fa'); // Light blue

    // Draw main frame
    ctx.beginPath();
    ctx.moveTo(-50, 10);
    ctx.lineTo(50, 10);
    ctx.lineTo(55, -2);
    ctx.lineTo(35, -8);
    ctx.lineTo(-40, -8);
    ctx.lineTo(-52, 2);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#93c5fd';
    ctx.stroke();

    // Draw Neon Trim line along bottom
    ctx.beginPath();
    ctx.moveTo(-48, 8);
    ctx.lineTo(48, 8);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#60a5fa';
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur = 10;
    ctx.stroke();
    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw Cockpit Cabin cage (cyber frame)
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(-5, -30);
    ctx.lineTo(20, -30);
    ctx.lineTo(32, -8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
    ctx.fillStyle = 'rgba(96, 165, 250, 0.25)'; // Tinted windshield
    ctx.fill();

    // Draw spoiler / Wing
    ctx.beginPath();
    ctx.moveTo(-45, -8);
    ctx.lineTo(-48, -25);
    ctx.lineTo(-33, -25);
    ctx.lineTo(-35, -8);
    ctx.closePath();
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#60a5fa';
    ctx.stroke();

    // Draw Driver's Helmet
    ctx.beginPath();
    ctx.arc(-5, -18, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; // White helmet
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    // Helmet visor
    ctx.beginPath();
    ctx.arc(-2, -18, 7, -Math.PI/3, Math.PI/3);
    ctx.lineTo(-2, -18);
    ctx.closePath();
    ctx.fillStyle = '#0f172a'; // Dark glass visor
    ctx.fill();

    ctx.restore();

    // 3. Draw Wheels (with spinning spokes)
    this.drawWheel(ctx, this.rearWheel);
    this.drawWheel(ctx, this.frontWheel);
  }

  /**
   * Helper to draw a sleek wheel with alloy spokes rotating along with physics angle
   */
  drawWheel(ctx, wheelBody) {
    ctx.save();
    ctx.translate(wheelBody.position.x, wheelBody.position.y);
    ctx.rotate(wheelBody.angle);

    const rad = this.wheelRadius;

    // Outer Tire (rubber)
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fillStyle = '#111827'; // Dark charcoal tire
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#374151'; // Tread outline
    ctx.stroke();

    // Tire tread details (radial cuts)
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rad - 3), Math.sin(a) * (rad - 3));
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.stroke();
    }

    // Inner Rim (Alloy wheel)
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#4b5563'; // Metallic grey alloy
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#9ca3af';
    ctx.stroke();

    // Alloy spokes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * rad * 0.6, Math.sin(a) * rad * 0.6);
      ctx.stroke();
    }

    // Neon hub center cap
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#60a5fa'; // Cyber blue center cap
    ctx.fill();
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#60a5fa';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

// Export class to global scope
window.Vehicle = Vehicle;
