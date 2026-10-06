/**
 * Main Application Orchestrator for Pip-Boy 2000 (Русская локализация)
 * Обработка вкладок, команд терминала на русском и английском, сенсорного управления и шеринга.
 */

document.addEventListener('DOMContentLoaded', () => {
  const stats = window.rpgStats;
  const inventory = window.inventoryManager;
  const world = window.worldMap;
  const audio = window.pipAudio;

  const cli = new window.PipCliEngine('cliLog');
  const asciiRenderer = new window.AsciiRenderer('asciiGrid');
  const combat = new window.CombatEngine(stats, inventory, world, cli, audio);

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

  // --- Регистрация команд CLI (русские и английские алиасы) ---
  const showHelp = () => {
    cli.log('=== ПРОТОКОЛ КОМАНД PIP-OS 2000 ===', 'msg-system');
    cli.log('  осмотр (look)      - Осмотреть текущие координаты и окружение', 'msg-system');
    cli.log('  с / ю / в / з      - Движение: Север, Юг, Восток, Запад (n, s, e, w)', 'msg-system');
    cli.log('  атака [часть]      - Атаковать цель: голова, торс, ноги (attack)', 'msg-system');
    cli.log('  ватс (vats)        - Тактический режим прицеливания V.A.T.S.', 'msg-system');
    cli.log('  инв (inv)          - Список снаряжения и припасов', 'msg-system');
    cli.log('  исп &lt;название&gt;   - Применить/надеть предмет (use)', 'msg-system');
    cli.log('  статы (stats)      - Параметры S.P.E.C.I.A.L. и статус', 'msg-system');
    cli.log('  ждать (wait)       - Пропустить ход и восстановить ОД', 'msg-system');
    cli.log('  турбо (turbo)      - Переключить турбо-режим для слабых телефонов', 'msg-system');
    cli.log('  чистить (clear)    - Очистить экран терминала', 'msg-system');
    cli.log('====================================', 'msg-system');
  };

  cli.registerCommand('помощь', showHelp);
  cli.registerCommand('help', showHelp);
  cli.registerCommand('?', showHelp);
  cli.registerCommand('турбо', () => toggleTurboMode());
  cli.registerCommand('turbo', () => toggleTurboMode());

  const lookSurroundings = () => {
    const tile = world.grid[world.playerY][world.playerX];
    let tileDesc = 'Вы стоите на холодном потрескавшемся бетоне сектора Убежища.';
    if (tile === '~') tileDesc = 'ВНИМАНИЕ: Вы стоите в радиоактивной луже! Счетчик Гейгера трещит!';
    
    const nearby = world.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - world.playerX, e.y - world.playerY) <= 4);
    let enemyDesc = nearby.length > 0 ? `Обнаружены враги поблизости (${nearby.length}): ${nearby.map(e => e.name).join(', ')}.` : 'Поблизости врагов не видно.';
    
    cli.log(`${tileDesc} ${enemyDesc}`, 'msg-system');
  };

  cli.registerCommand('осмотр', lookSurroundings);
  cli.registerCommand('look', lookSurroundings);

  cli.registerCommand('чистить', () => cli.clear());
  cli.registerCommand('clear', () => cli.clear());
  cli.registerCommand('cls', () => cli.clear());

  const waitTurn = () => {
    stats.restoreAp();
    combat.enemyTurn();
    cli.log('Вы перевели дыхание. Очки Действия восстановлены.', 'msg-system');
    updateAll();
  };

  cli.registerCommand('ждать', waitTurn);
  cli.registerCommand('отдых', waitTurn);
  cli.registerCommand('wait', waitTurn);

  // Движение
  cli.registerCommand('с', () => movePlayer(0, -1));
  cli.registerCommand('n', () => movePlayer(0, -1));
  cli.registerCommand('ю', () => movePlayer(0, 1));
  cli.registerCommand('s', () => movePlayer(0, 1));
  cli.registerCommand('в', () => movePlayer(1, 0));
  cli.registerCommand('e', () => movePlayer(1, 0));
  cli.registerCommand('з', () => movePlayer(-1, 0));
  cli.registerCommand('w', () => movePlayer(-1, 0));

  const handleMove = (args) => {
    const dir = args[0]?.toLowerCase();
    if (dir === 'с' || dir === 'север' || dir === 'n' || dir === 'north') movePlayer(0, -1);
    else if (dir === 'ю' || dir === 'юг' || dir === 's' || dir === 'south') movePlayer(0, 1);
    else if (dir === 'в' || dir === 'восток' || dir === 'e' || dir === 'east') movePlayer(1, 0);
    else if (dir === 'з' || dir === 'запад' || dir === 'w' || dir === 'west') movePlayer(-1, 0);
    else cli.log('Укажите направление: с, ю, в, з (n, s, e, w)', 'msg-combat');
  };
  cli.registerCommand('идти', handleMove);
  cli.registerCommand('move', handleMove);

  const handleAttack = (args) => {
    const part = args[0] || 'торс';
    const target = getClosestEnemy();
    if (!target) {
      cli.log('Поблизости нет целей для атаки!', 'msg-combat');
      return;
    }
    combat.attackTarget(target, part);
    updateAll();
  };
  cli.registerCommand('атака', handleAttack);
  cli.registerCommand('attack', handleAttack);
  cli.registerCommand('atk', handleAttack);

  const handleVats = () => triggerVats();
  cli.registerCommand('ватс', handleVats);
  cli.registerCommand('vats', handleVats);

  const handleStats = () => {
    cli.log(`S.P.E.C.I.A.L.: СИЛ:${stats.special.ST} ВОС:${stats.special.PE} ВЫН:${stats.special.EN} ХАР:${stats.special.CH} ИНТ:${stats.special.IN} ЛОВ:${stats.special.AG} УДЧ:${stats.special.LK}`, 'msg-system');
    cli.log(`Уровень: ${stats.level} | Опыт: ${stats.xp}/${stats.nextLevelXp} | Здоровье: ${stats.hp}/${stats.maxHp} | ОД: ${stats.ap}/${stats.maxAp} | Радиация: ${stats.rads} рад`, 'msg-system');
  };
  cli.registerCommand('статы', handleStats);
  cli.registerCommand('stats', handleStats);

  const handleInv = () => {
    cli.log('--- ИНВЕНТАРЬ PIP-BOY ---', 'msg-item');
    inventory.items.forEach(i => {
      const eq = (inventory.equippedWeapon?.id === i.id || inventory.equippedArmor?.id === i.id) ? '[НАДЕТО]' : '';
      cli.log(`• ${i.name} x${i.count} (Вес: ${Math.round(i.weight * i.count * 10)/10} фнт) ${eq}`, 'msg-item');
    });
    cli.log(`Общий вес: ${Math.round(inventory.getTotalWeight())}/${stats.calcCarryWeight()} фнт | Крышки: ${stats.caps} ☢`, 'msg-system');
  };
  cli.registerCommand('инв', handleInv);
  cli.registerCommand('инвентарь', handleInv);
  cli.registerCommand('inv', handleInv);

  const handleUse = (args) => {
    const query = args.join(' ').toLowerCase();
    if (!query) {
      cli.log('Использование: исп <название предмета>', 'msg-combat');
      return;
    }
    const item = inventory.findItemByName(query);
    if (item) {
      const msg = inventory.useItem(item);
      cli.log(msg, 'msg-item');
      audio.playClick();
      updateAll();
    } else {
      cli.log(`Предмет "${query}" не найден в инвентаре.`, 'msg-combat');
    }
  };
  cli.registerCommand('исп', handleUse);
  cli.registerCommand('использовать', handleUse);
  cli.registerCommand('use', handleUse);

  // --- Перемещение игрока ---
  function movePlayer(dx, dy) {
    const newX = world.playerX + dx;
    const newY = world.playerY + dy;

    // Взаимодействие с дверью
    if (world.grid[newY] && world.grid[newY][newX] === '+') {
      world.grid[newY][newX] = '/';
      cli.log('Вы открыли бронированную гермодверь.', 'msg-system');
      audio.playClick();
      updateAll();
      return;
    }

    // Атака при шаге во врага
    const enemyAtTile = world.getEnemyAt(newX, newY);
    if (enemyAtTile) {
      combat.attackTarget(enemyAtTile, 'торс');
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

    // Радиационная зона
    if (world.grid[newY][newX] === '~') {
      audio.playGeiger();
      stats.addRads(4);
      cli.log('☢ РАДИОАКТИВНОЕ ЗАРАЖЕНИЕ! +4 РАД!', 'msg-rad');
    }

    // Сбор лута
    const loot = world.getLootAt(newX, newY);
    if (loot) {
      loot.items.forEach(it => {
        if (it.id === 'caps') {
          stats.caps += it.count;
          cli.log(`Найдено ${it.count} крышек от бутылок!`, 'msg-item');
        } else {
          inventory.addItem(it);
          cli.log(`Подобрано: ${it.name} x${it.count || 1}!`, 'msg-item');
        }
      });
      world.loot = world.loot.filter(l => l.id !== loot.id);
      audio.playLevelUp();
    }

    // Лифт на поверхность
    if (world.grid[newY][newX] === '>') {
      cli.log('★ Сектор Убежища 13 зачищен! Доступен лифт в Пустошь! ★', 'msg-crit');
      audio.playLevelUp();
    }

    // Расход 1 ОД на шаг
    if (!stats.spendAp(1)) {
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
      cli.log('ОШИБКА V.A.T.S.: В зоне видимости нет врагов!', 'msg-combat');
      audio.playBeep(250, 0.1);
      return;
    }

    audio.playBeep(1400, 0.15);
    const headPct = combat.calculateHitChance(target, 'голова');
    const torsoPct = combat.calculateHitChance(target, 'торс');
    const legsPct = combat.calculateHitChance(target, 'ноги');

    const choice = prompt(`=== ЗАХВАТ ЦЕЛИ V.A.T.S. ===\nЦель: ${target.name} (Здоровье: ${target.hp}/${target.maxHp})\n\n1: ГОЛОВА (${headPct}% - Крит / 2.2x урон)\n2: ТОРС (${torsoPct}% - Высокая меткость)\n3: НОГИ (${legsPct}% - Шанс обездвижить)\n\nВведите 1, 2 или 3 (или Отмена):`);

    if (choice === '1') combat.attackTarget(target, 'голова');
    else if (choice === '2') combat.attackTarget(target, 'торс');
    else if (choice === '3') combat.attackTarget(target, 'ноги');
    else cli.log('Прицеливание V.A.T.S. отменено.', 'msg-system');

    updateAll();
  }

  // --- Переключение вкладок ---
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

  // --- Вкладка СТАТУС ---
  function renderStatusTab() {
    tabStatus.innerHTML = `
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-title">ПАРАМЕТРЫ S.P.E.C.I.A.L.</div>
          <div class="stat-row"><span>[СИЛ] СИЛА</span><span class="stat-val-highlight">${stats.special.ST}</span></div>
          <div class="stat-row"><span>[ВОС] ВОСПРИЯТИЕ</span><span class="stat-val-highlight">${stats.special.PE}</span></div>
          <div class="stat-row"><span>[ВЫН] ВЫНОСЛИВОСТЬ</span><span class="stat-val-highlight">${stats.special.EN}</span></div>
          <div class="stat-row"><span>[ХАР] ХАРИЗМА</span><span class="stat-val-highlight">${stats.special.CH}</span></div>
          <div class="stat-row"><span>[ИНТ] ИНТЕЛЛЕКТ</span><span class="stat-val-highlight">${stats.special.IN}</span></div>
          <div class="stat-row"><span>[ЛОВ] ЛОВКОСТЬ</span><span class="stat-val-highlight">${stats.special.AG}</span></div>
          <div class="stat-row"><span>[УДЧ] УДАЧА</span><span class="stat-val-highlight">${stats.special.LK}</span></div>
        </div>

        <div class="stats-card">
          <div class="stats-card-title">БОЕВЫЕ ПОКАЗАТЕЛИ</div>
          <div class="stat-row"><span>УРОВЕНЬ</span><span class="stat-val-highlight">${stats.level}</span></div>
          <div class="stat-row"><span>ОПЫТ</span><span>${stats.xp} / ${stats.nextLevelXp}</span></div>
          <div class="stat-row"><span>КЛАСС БРОНИ</span><span>${stats.calcArmorClass(inventory.equippedArmor?.acBonus || 0)}</span></div>
          <div class="stat-row"><span>ГРУЗ</span><span>${Math.round(inventory.getTotalWeight())} / ${stats.calcCarryWeight()} фнт</span></div>
          <div class="stat-row"><span>РАДИАЦИЯ</span><span class="${stats.rads > 50 ? 'stat-alert' : ''}">${stats.rads} РАД</span></div>
          <div class="stat-row"><span>КРЫШКИ</span><span class="stat-val-highlight">${stats.caps} ☢</span></div>
        </div>

        <div class="stats-card" style="grid-column: 1 / -1;">
          <div class="stats-card-title">НАВЫКИ И СПЕЦИАЛИЗАЦИИ (Очков навыков: ${stats.skillPoints})</div>
          <div class="stat-row">
            <span>Легкое оружие: ${stats.skills.smallGuns}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="smallGuns">+5%</button>` : ''}
          </div>
          <div class="stat-row">
            <span>Рукопашный бой: ${stats.skills.melee}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="melee">+5%</button>` : ''}
          </div>
          <div class="stat-row">
            <span>Первая помощь: ${stats.skills.firstAid}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="firstAid">+5%</button>` : ''}
          </div>
          <div class="stat-row">
            <span>Взлом замков: ${stats.skills.lockpick}%</span>
            ${stats.skillPoints >= 5 ? `<button class="stat-btn-plus" data-skill="lockpick">+5%</button>` : ''}
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

  // --- Вкладка ИНВЕНТАРЬ ---
  function renderInventoryTab() {
    tabInventory.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
        <span>ВЕС: ${Math.round(inventory.getTotalWeight())} / ${stats.calcCarryWeight()} ФНТ</span>
        <span>КРЫШКИ: ${stats.caps} ☢</span>
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
                <span style="font-size:11px; opacity:0.8;"> x${item.count} (${Math.round(item.weight * item.count * 10)/10} фнт)</span>
                ${isEquipped ? '<span style="color:#77ff77; font-size:10px;"> [НАДЕТО]</span>' : ''}
                <div style="font-size:10px; color:#8cb88c; margin-top:2px;">${item.desc || ''}</div>
              </div>
              <div class="item-actions">
                ${(item.type === 'weapon' || item.type === 'armor') ? `
                  <button class="btn-item-action btn-inv-equip" data-id="${item.id}">
                    ${isEquipped ? 'Снять' : 'Надеть'}
                  </button>
                ` : ''}
                ${(item.type === 'med' || item.type === 'food') ? `
                  <button class="btn-item-action btn-inv-use" data-id="${item.id}">Применить</button>
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

  // --- Вкладка АРХИВЫ ---
  function renderArchivesTab() {
    tabArchives.innerHTML = `
      <div style="background:#030803; border:1px solid var(--pip-green-dim); padding:10px; border-radius:4px; font-size:12px; line-height:1.4;">
        <h3 style="color:#fff; margin-bottom:6px;">АРХИВ ДАННЫХ VAULT-TEC // ДОКУМЕНТ #771-A</h3>
        <p style="margin-bottom:6px;"><strong>ОБЪЕКТ:</strong> Протокол зачистки нижнего уровня Убежища 13</p>
        <p style="margin-bottom:6px; color:#88cc88;">
          Датчики радиации фиксируют утечку охлаждающей жидкости в Секторе B-3. Зафиксирована активность мутировавших насекомых (Радтараканы) и рейдеров пустоши.
        </p>
        <p style="color:#ffb000;">
          [ДИРЕКТИВА]: Зачистить сектор, собрать уцелевшие медикаменты, нейтрализовать мародеров и добраться до грузового лифта на поверхность (&gt;).
        </p>
      </div>
    `;
  }

  // --- Обновление HUD телеметрии ---
  function updateHud() {
    if (hudHp) hudHp.textContent = `${stats.hp}/${stats.maxHp}`;
    if (hudAp) hudAp.textContent = `${stats.ap}/${stats.maxAp}`;
    if (hudRads) {
      hudRads.textContent = `${stats.rads}р`;
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

  // --- Переключение вкладок кнопками сайдбара ---
  document.getElementById('btnNavStatus')?.addEventListener('click', () => switchTab('status'));
  document.getElementById('btnNavGame')?.addEventListener('click', () => switchTab('game'));
  document.getElementById('btnNavInventory')?.addEventListener('click', () => switchTab('inventory'));
  document.getElementById('btnNavArchives')?.addEventListener('click', () => switchTab('archives'));

  // Сенсорный D-Pad
  document.getElementById('dpadUp')?.addEventListener('click', () => movePlayer(0, -1));
  document.getElementById('dpadDown')?.addEventListener('click', () => movePlayer(0, 1));
  document.getElementById('dpadLeft')?.addEventListener('click', () => movePlayer(-1, 0));
  document.getElementById('dpadRight')?.addEventListener('click', () => movePlayer(1, 0));
  document.getElementById('dpadWait')?.addEventListener('click', () => {
    stats.restoreAp();
    combat.enemyTurn();
    cli.log('Вы пропустили ход и восстановили ОД.', 'msg-system');
    audio.playClick();
    updateAll();
  });

  // Сенсорные кнопки действий
  document.getElementById('btnTouchAtk')?.addEventListener('click', () => {
    const target = getClosestEnemy();
    if (target) {
      combat.attackTarget(target, 'торс');
      updateAll();
    } else {
      cli.log('Врагов поблизости нет.', 'msg-combat');
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
      cli.log('Стимпаки закончились!', 'msg-combat');
    }
  });

  document.getElementById('btnTouchInv')?.addEventListener('click', () => switchTab('inventory'));

  // Отправка команды CLI
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

  // Горячие клавиши клавиатуры (WASD, стрелки, пробел, 1-4)
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === cliInput) return;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') movePlayer(0, -1);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') movePlayer(0, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') movePlayer(-1, 0);
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') movePlayer(1, 0);
    else if (e.key === ' ' || e.key === 'Spacebar') {
      waitTurn();
    } else if (e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М') {
      triggerVats();
    } else if (e.key === '1') switchTab('status');
    else if (e.key === '2') switchTab('game');
    else if (e.key === '3') switchTab('inventory');
    else if (e.key === '4') switchTab('archives');
  });

  // --- ТУРБО-РЕЖИМ (ДЛЯ СЛАБЫХ ТЕЛЕФОНОВ / SAMSUNG J4) ---
  const btnTurboToggle = document.getElementById('btnTurboToggle');
  
  function setTurboMode(enable) {
    if (enable) {
      document.body.classList.add('turbo-mode');
      if (btnTurboToggle) {
        btnTurboToggle.textContent = '⚡ ТУРБО: ВКЛ';
        btnTurboToggle.classList.add('turbo-active');
      }
      localStorage.setItem('pipboy_turbo', 'true');
    } else {
      document.body.classList.remove('turbo-mode');
      if (btnTurboToggle) {
        btnTurboToggle.textContent = '⚡ ТУРБО: ВЫКЛ';
        btnTurboToggle.classList.remove('turbo-active');
      }
      localStorage.setItem('pipboy_turbo', 'false');
    }
    updateAll();
  }

  function toggleTurboMode() {
    const isNow = !document.body.classList.contains('turbo-mode');
    setTurboMode(isNow);
    audio.playClick();
    if (isNow) {
      cli.log('⚡ ТУРБО-РЕЖИМ ВКЛЮЧЕН: сканлинии, мерцание и тени отключены для максимального FPS.', 'msg-item');
    } else {
      cli.log('⚡ ТУРБО-РЕЖИМ ВЫКЛЮЧЕН: стандартный ЭЛТ-профиль Pip-Boy восстановлен.', 'msg-system');
    }
  }

  btnTurboToggle?.addEventListener('click', toggleTurboMode);

  // Автоопределение слабых мобильных устройств
  const savedTurbo = localStorage.getItem('pipboy_turbo');
  if (savedTurbo === 'true') {
    setTurboMode(true);
  } else if (savedTurbo === null) {
    // Если запуск на 4-ядерном бюджетном телефоне (Cortex-A53) или мало памяти
    const isWeakDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                         (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
                         (window.innerWidth <= 480);
    if (isWeakDevice) {
      setTurboMode(true);
      setTimeout(() => {
        cli.log('⚡ Автоматически включен ТУРБО-РЕЖИМ для плавной работы на вашем устройстве.', 'msg-item');
      }, 500);
    }
  }

  // Переключатель звука
  document.getElementById('btnAudioToggle')?.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    document.getElementById('btnAudioToggle').textContent = isMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
    audio.playClick();
  });

  // Модальное окно "Поделиться / QR-код для телефона"
  const modalShare = document.getElementById('modalShare');
  const btnShareOpen = document.getElementById('btnShareOpen');
  const btnShareClose = document.getElementById('btnShareClose');
  const shareUrlInput = document.getElementById('shareUrlInput');
  const btnCopyUrl = document.getElementById('btnCopyUrl');

  if (btnShareOpen && modalShare) {
    btnShareOpen.addEventListener('click', () => {
      audio.playClick();
      // Определяем актуальный URL (при локальном запуске используем публичный URL на GitHub Pages)
      const publicUrl = 'https://rasfsaf.github.io/pipboy-2000-rpg/';
      const currentUrl = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
        ? publicUrl 
        : window.location.href;
      if (shareUrlInput) shareUrlInput.value = currentUrl;

      // Генерируем QR-код через проверенный сервис
      const qrImg = document.getElementById('qrCodeImage');
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}&color=51-255-68&bgcolor=7-14-6`;
      }
      modalShare.style.display = 'flex';
    });
  }

  if (btnShareClose && modalShare) {
    btnShareClose.addEventListener('click', () => {
      audio.playClick();
      modalShare.style.display = 'none';
    });
  }

  if (btnCopyUrl && shareUrlInput) {
    btnCopyUrl.addEventListener('click', () => {
      shareUrlInput.select();
      navigator.clipboard?.writeText(shareUrlInput.value);
      btnCopyUrl.textContent = 'СКОПИРОВАНО!';
      audio.playClick();
      setTimeout(() => { btnCopyUrl.textContent = 'КОПИРОВАТЬ'; }, 2000);
    });
  }

  // Приветственные сообщения в консоли
  cli.log('PIP-BOY 2000 BIOS v2.4.1 [РУССКАЯ ВЕРСИЯ]', 'msg-system');
  cli.log('ИНИЦИАЛИЗАЦИЯ ASCII МАТРИЦЫ VAULT-TEC...', 'msg-system');
  cli.log('Используйте D-Pad, WASD или строку команд. Введите "помощь" для списка команд.', 'msg-item');

  switchTab('game');
  updateAll();
});
