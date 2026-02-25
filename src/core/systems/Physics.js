export class Physics {
  static updateBird(bird, dt, gravity, maxFall) {
    bird.vy = Math.min(maxFall, bird.vy + gravity * dt);
    bird.y += bird.vy * dt;
    bird.rotation = Math.max(-0.6, Math.min(1.25, bird.vy / 740));
  }

  static flap(bird, impulse) {
    bird.vy = -impulse;
  }
}