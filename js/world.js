/**
 * ASCII Roguelike World & Map Generator
 * Generates Vault 13 bunker ruins, radiation pools, loot caches, and wasteland mutants.
 */

class WorldMap {
  constructor(width = 27, height = 13) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.discovered = [];
    this.visible = [];
    this.enemies = [];
    this.loot = [];
    this.playerX = 3;
    this.playerY = 3;

    this.generateVaultSector();
  }

  generateVaultSector() {
    this.grid = [];
    this.discovered = [];
    this.visible = [];

    // Base map template of Vault 13 sub-level ruins
    const mapTemplate = [
      "###########################",
      "#...#.....#.......#.......#",
      "#...#..r..#...$...+...R...#",
      "#...+.....#.......#.......#",
      "#####+#####...G...#########",
      "#.........#.......#.......#",
      "#....$....#.......+...$...#",
      "#.........#########.......#",
      "#####+#####.......#########",
      "#.......#...~~~...#.......#",
      "#...r...+...~~~...+...r...#",
      "#.......#...~~~...#.....>.#",
      "###########################"
    ];

    this.height = mapTemplate.length;
    this.width = mapTemplate[0].length;
    this.enemies = [];
    this.loot = [];

    let enemyId = 1;
    let lootId = 1;

    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      this.discovered[y] = [];
      this.visible[y] = [];

      for (let x = 0; x < this.width; x++) {
        let char = mapTemplate[y][x];
        this.discovered[y][x] = false;
        this.visible[y][x] = false;

        if (char === 'r') {
          this.enemies.push({
            id: enemyId++,
            type: 'radroach',
            name: 'Radroach',
            symbol: 'r',
            x: x,
            y: y,
            hp: 14,
            maxHp: 14,
            ac: 8,
            minDmg: 2,
            maxDmg: 5,
            ap: 6,
            xp: 35
          });
          char = '.';
        } else if (char === 'R') {
          this.enemies.push({
            id: enemyId++,
            type: 'raider',
            name: 'Wasteland Raider',
            symbol: 'R',
            x: x,
            y: y,
            hp: 30,
            maxHp: 30,
            ac: 14,
            minDmg: 5,
            maxDmg: 9,
            ap: 7,
            xp: 90
          });
          char = '.';
        } else if (char === 'G') {
          this.enemies.push({
            id: enemyId++,
            type: 'ghoul',
            name: 'Glowing One Ghoul',
            symbol: 'G',
            x: x,
            y: y,
            hp: 42,
            maxHp: 42,
            ac: 16,
            minDmg: 8,
            maxDmg: 13,
            ap: 8,
            xp: 150
          });
          char = '.';
        } else if (char === '$') {
          this.loot.push({
            id: lootId++,
            x: x,
            y: y,
            items: this.generateRandomLoot()
          });
          char = '.';
        }

        this.grid[y][x] = char;
      }
    }

    this.computeFov(this.playerX, this.playerY, 6);
  }

  generateRandomLoot() {
    const table = [
      [{ id: 'stimpak', name: 'Stimpak', type: 'med', heal: 25, weight: 0.5, value: 25, count: 2 }],
      [{ id: '10mm_ammo', name: '10mm JHP Ammo', type: 'ammo', weight: 0.05, value: 2, count: 18 }, { id: 'caps', name: 'Bottle Caps', count: 25 }],
      [{ id: 'radaway', name: 'RadAway', type: 'med', radHeal: 60, weight: 0.5, value: 40, count: 1 }, { id: 'nuka_cola', name: 'Nuka-Cola', type: 'food', heal: 8, rads: 3, weight: 1, count: 2 }],
      [{ id: 'combat_knife', name: 'Combat Knife', type: 'weapon', minDmg: 4, maxDmg: 8, apCost: 3, range: 1, weight: 1, value: 30, count: 1 }]
    ];
    return table[Math.floor(Math.random() * table.length)];
  }

  isPassable(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const tile = this.grid[y][x];
    if (tile === '#' || tile === '+') return false;
    // Check enemy collision
    if (this.getEnemyAt(x, y)) return false;
    return true;
  }

  getEnemyAt(x, y) {
    return this.enemies.find(e => e.x === x && e.y === y && e.hp > 0);
  }

  getLootAt(x, y) {
    return this.loot.find(l => l.x === x && l.y === y);
  }

  computeFov(pX, pY, radius = 6) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visible[y][x] = false;
        const dist = Math.hypot(x - pX, y - pY);
        if (dist <= radius) {
          // Simple LOS raycast
          if (this.hasLineOfSight(pX, pY, x, y)) {
            this.visible[y][x] = true;
            this.discovered[y][x] = true;
          }
        }
      }
    }
  }

  hasLineOfSight(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      if (cx === x1 && cy === y1) return true;
      if ((cx !== x0 || cy !== y0) && this.grid[cy][cx] === '#') {
        return false;
      }
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }
}

window.worldMap = new WorldMap();
