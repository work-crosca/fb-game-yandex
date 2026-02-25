export class Scoring {
  static countPassed(pipes, birdX) {
    let gained = 0;
    for (const p of pipes) {
      if (!p.scored && p.x + p.width < birdX) {
        p.scored = true;
        gained += 1;
      }
    }
    return gained;
  }
}