/**
 * ASCII World Grid & UI Graphic Renderer
 * Renders the monochrome phosphor grid, entities, fog of war, and Vault Boy ASCII portraits.
 */

class AsciiRenderer {
  constructor(gridElementId) {
    this.gridEl = document.getElementById(gridElementId);
  }

  renderWorld(world) {
    if (!this.gridEl) return;

    const isTurbo = document.body.classList.contains('turbo-mode');
    let outputHtml = '';

    for (let y = 0; y < world.height; y++) {
      let lineHtml = '';
      for (let x = 0; x < world.width; x++) {
        const isVisible = world.visible[y][x];
        const isDiscovered = world.discovered[y][x];

        if (isVisible) {
          // Player
          if (x === world.playerX && y === world.playerY) {
            lineHtml += `<span class="tile-player">@</span>`;
            continue;
          }

          // Enemy
          const enemy = world.getEnemyAt(x, y);
          if (enemy) {
            const cls = enemy.type === 'radroach' ? 'tile-radroach' : enemy.type === 'ghoul' ? 'tile-ghoul' : 'tile-raider';
            lineHtml += `<span class="${cls}">${enemy.symbol}</span>`;
            continue;
          }

          // Loot
          const loot = world.getLootAt(x, y);
          if (loot) {
            lineHtml += `<span class="tile-loot">$</span>`;
            continue;
          }

          // Tile
          const tile = world.grid[y][x];
          if (isTurbo) {
            // Turbo Mode: Прямой вывод без тяжелых тегов span для стен и полов
            if (tile === '~') {
              lineHtml += `<span class="tile-rad">~</span>`;
            } else if (tile === '+' || tile === '/') {
              lineHtml += `<span class="tile-door">${tile}</span>`;
            } else if (tile === '>') {
              lineHtml += `<span class="tile-loot">&gt;</span>`;
            } else {
              lineHtml += tile; // '#' или '.' напрямую
            }
          } else {
            // Стандартный режим
            if (tile === '#') {
              lineHtml += `<span class="tile-wall">#</span>`;
            } else if (tile === '.') {
              lineHtml += `<span class="tile-floor">.</span>`;
            } else if (tile === '~') {
              lineHtml += `<span class="tile-rad">~</span>`;
            } else if (tile === '+' || tile === '/') {
              lineHtml += `<span class="tile-door">${tile}</span>`;
            } else if (tile === '>') {
              lineHtml += `<span class="tile-loot">&gt;</span>`;
            } else {
              lineHtml += tile;
            }
          }
        } else if (isDiscovered) {
          // Туман войны
          const tile = world.grid[y][x];
          if (isTurbo) {
            lineHtml += tile === '#' ? '#' : '.';
          } else {
            if (tile === '#') {
              lineHtml += `<span style="color:#0f3814">#</span>`;
            } else if (tile === '~') {
              lineHtml += `<span style="color:#114420">~</span>`;
            } else {
              lineHtml += `<span style="color:#09220d">.</span>`;
            }
          }
        } else {
          lineHtml += ` `;
        }
      }
      outputHtml += lineHtml + '\n';
    }

    this.gridEl.innerHTML = outputHtml;
  }

  static getVaultBoyAscii() {
    return [
      "    .-------.    ",
      "   /  .---.  \\   ",
      "  |  / O O \\  |  ",
      "  |  |  ^  |  |  ",
      "   \\  \\_=_/  /   ",
      "    '-|---|-'    ",
      "   /  |   | \\(\\  ",
      "  |   |===|  |_) ",
      "   \\  |   | /    ",
      "    '-'---'-'    "
    ].join('\n');
  }
}

window.AsciiRenderer = AsciiRenderer;
