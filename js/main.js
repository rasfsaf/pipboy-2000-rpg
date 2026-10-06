/**
 * Main Application Orchestrator for Pip-Boy 2000
 * Handles UI tab switching, user input, touch D-Pad controls, game loop & CLI bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
  const stats = window.rpgStats;
  const inventory = window.inventoryManager;
  const world = window.worldMap;
  const audio = window.pipAudio;

  const cli = new window.PipCliEngine('cliLog');
  const asciiRenderer = new window.AsciiRenderer('asciiGrid');
  const combat = new window.CombatEngine(stats, inventory, world, cli, audio);

  // Tab State
  let currentTab = 'game';

  // --- UI References ---
  const tabGame = document.getElementById('tabGame');
  const tabStatus = document.getElementById('tabStatus');
  const tabInventory = document.getElementById('tabInventory');
  const tabArchives = document.getElementById('tabArchives');

  const hudHp = document.getElementById('hudHp');
  const hudAp = document.getElementById('hudAp');
  const hudRads = document.getElementById('hudRads');
  const hudCaps = document.getElementById('hudCaps');

  const cliInput = document.getElementById('cliInput');
  const btnRunCmd = document.getElementById('btnRunCmd');

  // --- Register CLI Commands ---
  cli.registerCommand('help', () => {
    cli.log('=== PIP-OS 2000 COMMAND PROTOCOL ===', 'msg-system');
    cli.log('  look           - Inspect current coordinates and surroundings', 'msg-system');
    cli.log('  n / s / e / w  - Move North, South, East, West (or "move &lt;dir&gt;")', 'msg-system');
    cli.log('  attack [part]  - Attack adjacent target (head/torso/legs)', 'msg-system');
    cli.log('  vats           - Tactical VATS precision targeting', 'msg-system');
    cli.log('  inv            - List carried equipment and supplies', 'msg-system');
    cli.log('  use &lt;item&gt;    - Use or equip item (e.g. "use stimpak")', 'msg-system');
    cli.log('  stats          - View S.P.E.C.I.A.L. attributes', 'msg-system');
    cli.log('  wait           - Rest 1 turn to regenerate Action Points', 'msg-system');
    cli.log('  clear          - Clear terminal display buffer', 'msg-system');
    cli.log('====================================', 'msg-system');
  }, 'List commands');

  cli.registerCommand('look', () => {
    const tile = world.grid[world.playerY][world.playerX];
    let tileDesc = 'You stand on cold cracked Vault concrete.';
    if (tile === '~') tileDesc = 'WARNING: You stand inside toxic radioactive sludge! Geiger counter clicks rapidly!';
    
    // Check nearby entities
    const nearby = world.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - world.playerX, e.y - world.playerY) <= 4);
    let enemyDesc = nearby.length > 0 ? `Detected ${nearby.length} hostile creature(s) nearby: ${nearby.map(e => e.name).join(', ')}.` : 'No immediate hostiles in sight.';
    
    cli.log(`${tileDesc} ${enemyDesc}`, 'msg-system');
  });

  cli.registerCommand('clear', () => cli.clear());
  cli.registerCommand('cls', () => cli.clear());

  cli.registerCommand('wait', () => {
    stats.restoreAp();
    combat.enemyTurn();
    cli.log('You wait a turn. Action Points replenished.', 'msg-system');
    updateAll();
  });

  cli.registerCommand('n', () => movePlayer(0, -1));
  cli.registerCommand('s', () => movePlayer(0, 1));
  cli.registerCommand('e', () => movePlayer(1, 0));
  cli.registerCommand('w', () => movePlayer(-1, 0));

  cli.registerCommand('move', (args) => {
    const dir = args[0]?.toLowerCase();
    if (dir === 'n' || dir === 'north') movePlayer(0, -1);
    else if (dir === 's' || dir === 'south') movePlayer(0, 1);
    else if (dir === 'e' || dir === 'east') movePlayer(1, 0);
    else if (dir === 'w' || dir === 'west') movePlayer(-1, 0);
    else cli.log('Specify direction: n, s, e, w', 'msg-combat');
  });

  cli.registerCommand('attack', (args) => {
    const part = args[0] || 'torso';
    // Find closest enemy
    const target = getClosestEnemy();
    if (!target) {
      cli.log('No targets in range to attack!', 'msg-combat');
      return;
    }
    combat.attackTarget(target, part);
    updateAll();
  });

  cli.registerCommand('vats', () => {
    triggerVats();
  });

  cli.registerCommand('stats', () => {
    cli.log(`S.P.E.C.I.A.L.: ST:${stats.special.ST} PE:${stats.special.PE} EN:${stats.special.EN} CH:${stats.special.CH} IN:${stats.special.IN} AG:${stats.special.AG} LK:${stats.special.LK}`, 'msg-system');
    cli.log(`Level: ${stats.level} | XP: ${stats.xp}/${stats.nextLevelXp} | HP: ${stats.hp}/${stats.maxHp} | AP: ${stats.ap}/${stats.maxAp} | Rads: ${stats.rads} rads`, 'msg-system');
  });

  cli.registerCommand('inv', () => {
    cli.log('--- PIP-BOY INVENTORY ---', 'msg-item');
    inventory.items.forEach(i => {
      const eq = (inventory.equippedWeapon?.id === i.id || inventory.equippedArmor?.id === i.id) ? '[EQUIPPED]' : '';
      cli.log(`• ${i.name} x${i.count} (Wt: ${i.weight * i.count} lbs) ${eq}`, 'msg-item');
    });
    cli.log(`Total Weight: ${inventory.getTotalWeight()}/${stats.calcCarryWeight()} lbs | Caps: ${stats.caps}`, 'msg-system');
  });

  cli.registerCommand('use', (args) => {
    const query = args.join(' ').toLowerCase();
    if (!query) {
      cli.log('Usage: use <item name>', 'msg-combat');
      return;
    }
    const item = inventory.items.find(i => i.name.toLowerCase().includes(query) || i.id.includes(query));
    if (item) {
      const msg = inventory.useItem(item);
      cli.log(msg, 'msg-item');
      audio.playClick();
      updateAll();
    } else {
      cli.log(`Item "${query}" not found in inventory.`, 'msg-combat');
    }
  });

  // --- Player Movement & Tile Interactions ---
  function movePlayer(dx, dy) {
    const newX = world.playerX + dx;
    const newY = world.playerY + dy;

    // Check door interaction
    if (world.grid[newY] && world.grid[newY][newX] === '+') {
      world.grid[newY][newX] = '/';
      cli.log('You opened the reinforced security door.', 'msg-system');
      audio.playClick();
      updateAll();
      return;
    }

    // Check enemy bump attack
    const enemyAtTile = world.getEnemyAt(newX, newY);
    if (enemyAtTile) {
      combat.attackTarget(enemyAtTile, 'torso');
      updateAll();
      return;
    }

    if (!world.isPassable(newX, newY)) {
      audio.playBeep(300, 0.05);
      return;
    }

    world.playerX = newX;
    world.playerY = newY;
    world.computeFov(world.playerX, world.playerY, 6);
    audio.playClick();

    // Check radiation puddle
    if (world.grid[newY][newX] === '~') {
      audio.playGeiger();
      stats.addRads(4);
      cli.log('☢ RADIATION CONTAMINATION! +4 RADS!', 'msg-rad');
    }

    // Check loot cache
    const loot = world.getLootAt(newX, newY);
    if (loot) {
      loot.items.forEach(it => {
        if (it.id === 'caps') {
          stats.caps += it.count;
          cli.log(`Found ${it.count} Bottle Caps in container!`, 'msg-item');
        } else {
          inventory.addItem(it);
          cli.log(`Scavenged ${it.name} x${it.count || 1}!`, 'msg-item');
        }
      });
      world.loot = world.loot.filter(l => l.id !== loot.id);
      audio.playLevelUp();
    }

    // Check bunker exit
    if (world.grid[newY][newX] === '>') {
      cli.log('★ Vault 13 Sector Cleared! Elevator to Wasteland accessible! ★', 'msg-crit');
      audio.playLevelUp();
    }

    // Spend AP for movement (1 AP per step)
    if (!stats.spendAp(1)) {
      // AP depleted, trigger enemy turn and restore
      combat.enemyTurn();
      stats.restoreAp();
    }

    updateAll();
  }

  function getClosestEnemy() {
    let closest = null;
    let minDist = 999;
    world.enemies.forEach(e => {
      if (e.hp > 0 && world.visible[e.y][e.x]) {
        const d = Math.hypot(e.x - world.playerX, e.y - world.playerY);
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      }
    });
    return closest;
  }

  function triggerVats() {
    const target = getClosestEnemy();
    if (!target) {
      cli.log('V.A.T.S. ERROR: No hostile target in sight!', 'msg-combat');
      audio.playBeep(250, 0.1);
      return;
    }

    audio.playBeep(1400, 0.15);
    const headPct = combat.calculateHitChance(target, 'head');
    const torsoPct = combat.calculateHitChance(target, 'torso');
    const legsPct = combat.calculateHitChance(target, 'legs');

    const choice = prompt(`=== V.A.T.S. TARGET ACQUISITION ===\nTarget: ${target.name} (HP: ${target.hp}/${target.maxHp})\n\n1: HEAD (${headPct}% - High Crit / 2.2x Dmg)\n2: TORSO (${torsoPct}% - High Accuracy)\n3: LEGS (${legsPct}% - Cripple Chance)\n\nEnter 1, 2, or 3 (or cancel):`);

    if (choice === '1') combat.attackTarget(target, 'head');
    else if (choice === '2') combat.attackTarget(target, 'torso');
    else if (choice === '3') combat.attackTarget(target, 'legs');
    else cli.log('V.A.T.S. Targeting cancelled.', 'msg-system');

    updateAll();
  }

  // --- Tab Switching ---
  function switchTab(tabName) {
    currentTab = tabName;
    audio.playClick();

    document.querySelectorAll('.pip-switch-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    const btn = document.getElementById(`btnNav${capitalize(tabName)}`);
    if (btn) btn.classList.add('active');

    const tabEl = document.getElementById(`tab${capitalize(tabName)}`);
    if (tabEl) tabEl.classList.add('active');

    if (tabName === 'status') renderStatusTab();
    if (tabName === 'inventory') renderInventoryTab();
    if (tabName === 'archives') renderArchivesTab();
    if (tabName === 'game') asciiRenderer.renderWorld(world);
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // --- Render Status Tab ---
  function renderStatusTab() {
    tabStatus.innerHTML = `
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-title">S.P.E.C.I.A.L. ATTRIBUTES</div>
          <div class="stat-row"><span>[ST] STRENGTH</span><span class="stat-val-highlight">${stats.special.ST}</span></div>
          <div class="stat-row"><span>[PE] PERCEPTION</span><span class="stat-val-highlight">${stats.special.PE}</span></div>
          <div class="stat-row"><span>[EN] ENDURANCE</span><span class="stat-val-highlight">${stats.special.EN}</span></div>
          <div class="stat-row"><span>[CH] CHARISMA</span><span class="stat-val-highlight">${stats.special.CH}</span></div>
          <div class="stat-row"><span>[IN] INTELLIGENCE</span><span class="stat-val-highlight">${stats.special.IN}</span></div>
          <div class="stat-row"><span>[AG] AGILITY</span><span class="stat-val-highlight">${stats.special.AG}</span></div>
          <div class="stat-row"><span>[LK] LUCK</span><span class="stat-val-highlight">${stats.special.LK}</span></div>
        </div>

        <div class="stats-card">
          <div class="stats-card-title">COMBAT & SURVIVAL</div>
          <div class="stat-row"><span>LEVEL</span><span class="stat-val-highlight">${stats.level}</span></div>
          <div class="stat-row"><span>EXP</span><span>${stats.xp} / ${stats.nextLevelXp}</span></div>
          <div class="stat-row"><span>ARMOR CLASS</span><span>${stats.calcArmorClass(inventory.equippedArmor?.acBonus || 0)}</span></div>
          <div class="stat-row"><span>CARRY WEIGHT</span><span>${Math.round(inventory.getTotalWeight())} / ${stats.calcCarryWeight()} lbs</span></div>
          <div class="stat-row"><span>RADIATION</span><span class="${stats.rads > 50 ? 'stat-alert' : ''}">${stats.rads} RADS</span></div>
          <div class="stat-row"><span>BOTTLE CAPS</span><span class="stat-val-highlight">${stats.caps} ☢</span></div>
        </div>

        <div class="stats-card" style="grid-column: 1 / -1;">
          <div class="stats-card-title">SKILLS & SPECIALIZATIONS (Skill Pts: ${stats.skillPoints})</div>
          <div class="stat-row">
            <span>Small Guns: ${stats.skills.smallGuns}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="smallGuns">+5</button>` : ''}
          </div>
          <div class="stat-row">
            <span>Melee Weapons: ${stats.skills.melee}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="melee">+5</button>` : ''}
          </div>
          <div class="stat-row">
            <span>First Aid: ${stats.skills.firstAid}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="firstAid">+5</button>` : ''}
          </div>
          <div class="stat-row">
            <span>Lockpick: ${stats.skills.lockpick}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="lockpick">+5</button>` : ''}
          </div>
        </div>
      </div>
    `;

    tabStatus.querySelectorAll('.stat-btn-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const skill = btn.getAttribute('data-skill');
        if (stats.upgradeSkill(skill)) {
          audio.playClick();
          renderStatusTab();
        }
      });
    });
  }

  // --- Render Inventory Tab ---
  function renderInventoryTab() {
    tabInventory.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
        <span>LOAD: ${Math.round(inventory.getTotalWeight())} / ${stats.calcCarryWeight()} LBS</span>
        <span>CAPS: ${stats.caps} ☢</span>
      </div>
      <div class="inv-list">
        ${inventory.items.map(item => {
          const isWep = inventory.equippedWeapon?.id === item.id;
          const isArm = inventory.equippedArmor?.id === item.id;
          const isEquipped = isWep || isArm;
          return `
            <div class="inv-item-row">
              <div>
                <strong style="color:${isEquipped ? '#55ff55' : '#fff'}">${item.name}</strong>
                <span style="font-size:11px; opacity:0.8;"> x${item.count} (${item.weight * item.count} lbs)</span>
                ${isEquipped ? '<span style="color:#77ff77; font-size:10px;"> [EQUIPPED]</span>' : ''}
                <div style="font-size:10px; color:#8cb88c; margin-top:2px;">${item.desc || ''}</div>
              </div>
              <div class="item-actions">
                ${(item.type === 'weapon' || item.type === 'armor') ? `
                  <button class="btn-item-action btn-inv-equip" data-id="${item.id}">
                    ${isEquipped ? 'Unequip' : 'Equip'}
                  </button>
                ` : ''}
                ${(item.type === 'med' || item.type === 'food') ? `
                  <button class="btn-item-action btn-inv-use" data-id="${item.id}">Use</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    tabInventory.querySelectorAll('.btn-inv-equip').forEach(b => {
      b.addEventListener('click', () => {
        const item = inventory.getItem(b.getAttribute('data-id'));
        if (item) {
          const res = inventory.equip(item);
          cli.log(res, 'msg-item');
          audio.playClick();
          renderInventoryTab();
          updateHud();
        }
      });
    });

    tabInventory.querySelectorAll('.btn-inv-use').forEach(b => {
      b.addEventListener('click', () => {
        const item = inventory.getItem(b.getAttribute('data-id'));
        if (item) {
          const res = inventory.useItem(item);
          cli.log(res, 'msg-item');
          audio.playClick();
          renderInventoryTab();
          updateHud();
        }
      });
    });
  }

  // --- Render Archives Tab ---
  function renderArchivesTab() {
    tabArchives.innerHTML = `
      <div style="background:#030803; border:1px solid var(--pip-green-dim); padding:10px; border-radius:4px; font-size:12px; line-height:1.4;">
        <h3 style="color:#fff; margin-bottom:6px;">VAULT-TEC DATA ARCHIVE // FILE #771-A</h3>
        <p style="margin-bottom:6px;"><strong>SUBJECT:</strong> Vault 13 Sub-Level Clearance Protocol</p>
        <p style="margin-bottom:6px; color:#88cc88;">
          Radiation sensors indicate leakages in Sector B-3. Biological hostiles detected including mutant Blatta orientalis (Radroach) and surface scavengers.
        </p>
        <p style="color:#ffb000;">
          [DIRECTIVE]: Secure the level, gather all surviving medical supplies, eliminate hostile scavengers, and reach the surface exit elevator (&gt;).
        </p>
      </div>
    `;
  }

  // --- Update HUD & Screen ---
  function updateHud() {
    if (hudHp) hudHp.textContent = `${stats.hp}/${stats.maxHp}`;
    if (hudAp) hudAp.textContent = `${stats.ap}/${stats.maxAp}`;
    if (hudRads) {
      hudRads.textContent = `${stats.rads}r`;
      if (stats.rads > 100) hudRads.classList.add('stat-alert');
      else hudRads.classList.remove('stat-alert');
    }
    if (hudCaps) hudCaps.textContent = stats.caps;
  }

  function updateAll() {
    updateHud();
    if (currentTab === 'game') {
      asciiRenderer.renderWorld(world);
    } else if (currentTab === 'status') {
      renderStatusTab();
    } else if (currentTab === 'inventory') {
      renderInventoryTab();
    }
  }

  // --- Event Listeners: Navigation Buttons ---
  document.getElementById('btnNavStatus')?.addEventListener('click', () => switchTab('status'));
  document.getElementById('btnNavGame')?.addEventListener('click', () => switchTab('game'));
  document.getElementById('btnNavInventory')?.addEventListener('click', () => switchTab('inventory'));
  document.getElementById('btnNavArchives')?.addEventListener('click', () => switchTab('archives'));

  // Mobile Touch D-Pad
  document.getElementById('dpadUp')?.addEventListener('click', () => movePlayer(0, -1));
  document.getElementById('dpadDown')?.addEventListener('click', () => movePlayer(0, 1));
  document.getElementById('dpadLeft')?.addEventListener('click', () => movePlayer(-1, 0));
  document.getElementById('dpadRight')?.addEventListener('click', () => movePlayer(1, 0));
  document.getElementById('dpadWait')?.addEventListener('click', () => {
    stats.restoreAp();
    combat.enemyTurn();
    cli.log('You rested and recovered Action Points.', 'msg-system');
    audio.playClick();
    updateAll();
  });

  // Mobile Touch Actions
  document.getElementById('btnTouchAtk')?.addEventListener('click', () => {
    const target = getClosestEnemy();
    if (target) {
      combat.attackTarget(target, 'torso');
      updateAll();
    } else {
      cli.log('No targets within attack range.', 'msg-combat');
    }
  });

  document.getElementById('btnTouchVats')?.addEventListener('click', () => triggerVats());
  
  document.getElementById('btnTouchStimpak')?.addEventListener('click', () => {
    const stim = inventory.getItem('stimpak');
    if (stim && stim.count > 0) {
      const msg = inventory.useItem(stim);
      cli.log(msg, 'msg-item');
      audio.playClick();
      updateAll();
    } else {
      cli.log('No Stimpaks in inventory!', 'msg-combat');
    }
  });

  document.getElementById('btnTouchInv')?.addEventListener('click', () => switchTab('inventory'));

  // CLI Input Submit
  function submitCli() {
    const cmd = cliInput.value;
    if (cmd.trim()) {
      cli.execute(cmd);
      cliInput.value = '';
    }
  }

  btnRunCmd?.addEventListener('click', submitCli);
  cliInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitCli();
    } else if (e.key === 'ArrowUp') {
      cliInput.value = cli.getHistoryPrev();
    } else if (e.key === 'ArrowDown') {
      cliInput.value = cli.getHistoryNext();
    }
  });

  // Keyboard Shortcuts (WASD, Arrows, 1-4 for tabs)
  window.addEventListener('keydown', (e) => {
    // If typing in input, don't trigger game hotkeys
    if (document.activeElement === cliInput) return;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') movePlayer(0, -1);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') movePlayer(0, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movePlayer(-1, 0);
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movePlayer(1, 0);
    else if (e.key === ' ' || e.key === 'Spacebar') {
      stats.restoreAp();
      combat.enemyTurn();
      cli.log('Turn skipped. AP recovered.', 'msg-system');
      updateAll();
    } else if (e.key === 'v' || e.key === 'V') {
      triggerVats();
    } else if (e.key === '1') switchTab('status');
    else if (e.key === '2') switchTab('game');
    else if (e.key === '3') switchTab('inventory');
    else if (e.key === '4') switchTab('archives');
  });

  // Audio Toggle Button
  document.getElementById('btnAudioToggle')?.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    document.getElementById('btnAudioToggle').textContent = isMuted ? 'MUTE: ON' : 'AUDIO: ON';
    audio.playClick();
  });

  // First boot logging
  cli.log('PIP-BOY 2000 BIOS v2.4.1 DETECTED.', 'msg-system');
  cli.log('INITIALIZING VAULT-TEC ASCII SUBSYSTEM...', 'msg-system');
  cli.log('Ready! Use D-Pad, WASD, or CLI below. Type "help" for command list.', 'msg-item');

  // Initial draw
  switchTab('game');
  updateAll();
});
