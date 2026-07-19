/**
 * Mountain Rush - Physics Manager
 * Sets up and manages the Matter.js engine, world, and collision groups.
 */
class PhysicsManager {
  constructor() {
    this.engine = null;
    this.world = null;

    // Setup collision categories (must be powers of 2 for Matter.js filters)
    this.COLLISION_CATEGORIES = {
      TERRAIN: 0x0001,
      VEHICLE_CHASSIS: 0x0002,
      VEHICLE_WHEEL: 0x0004,
      COLLECTIBLE: 0x0008,
      DRIVER_HEAD: 0x0010
    };
  }

  /**
   * Initializes the Matter.js physics engine
   */
  init() {
    // Create Matter.js Engine
    this.engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: 1.2 // Slightly higher gravity for arcade hill climbing feel
      }
    });

    this.world = this.engine.world;

    console.log("Matter.js physics engine initialized.");
  }

  /**
   * Updates the physics simulation by a time step
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  update(deltaTime) {
    if (!this.engine) return;
    
    // Cap step size to prevent tunneling through thin terrain at low frame rates
    const stepSize = Math.min(deltaTime, 30);
    Matter.Engine.update(this.engine, stepSize);
  }

  /**
   * Clears all bodies and constraints from the world
   */
  clearWorld() {
    if (!this.world) return;
    
    // Clear all composites
    Matter.Composite.clear(this.world, false);
    
    // Reset gravity in case it was modified
    this.world.gravity.y = 1.2;
    this.world.gravity.x = 0;
  }
}

// Global physics manager instance
window.physicsManager = new PhysicsManager();
