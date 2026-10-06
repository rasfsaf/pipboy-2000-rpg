/**
 * Fallout Turn-Based Combat & VATS Targeting Engine (Русская локализация)
 * Расчет шанса попадания, критических попаданий, урона по частям тела и ходов врагов.
 */

class CombatEngine {
  constructor(stats, inventory, world, cli, audio) {
    this.stats = stats;
    this.inv = inventory;
    this.world = world;
    this.cli = cli;
    this.audio = audio;
    this.inCombat = false;
  }

  calculateHitChance(target, bodyPart = 'torso', weapon = null) {
    const w = weapon || this.inv.equippedWeapon;
    const isRanged = w && w.type === 'weapon' && w.range > 1;
    const skillVal = isRanged ? this.stats.skills.smallGuns : this.stats.skills.melee;

    const dist = Math.hypot(target.x - this.world.playerX, target.y - this.world.playerY);
    let penalty = 0;

    if (isRanged) {
      if (dist > w.range) penalty += (dist - w.range) * 15;
    } else if (dist > 1.5) {
      return 0; // Вне дистанции рукопашного боя
    }

    let partModifier = 0;
    if (bodyPart === 'head' || bodyPart === 'голова') partModifier = -25;
    if (bodyPart === 'legs' || bodyPart === 'ноги') partModifier = -10;
    if (bodyPart === 'torso' || bodyPart === 'торс') partModifier = 10;

    const baseChance = skillVal + (this.stats.special.PE * 4) + partModifier - target.ac - penalty;
    return Math.max(5, Math.min(95, Math.round(baseChance)));
  }

  attackTarget(target, bodyPart = 'torso') {
    const weapon = this.inv.equippedWeapon || { name: 'Кулаки', minDmg: 1, maxDmg: 3, apCost: 2, range: 1 };
    
    // Проверка Очков Действия (AP)
    if (this.stats.ap < weapon.apCost) {
      this.cli.log(`Недостаточно Очков Действия! Нужно: ${weapon.apCost} ОД, доступно: ${this.stats.ap} ОД.`, 'msg-combat');
      return false;
    }

    // Проверка патронов
    if (weapon.id === '10mm_pistol') {
      const ammo = this.inv.getItem('10mm_ammo');
      if (!ammo || ammo.count <= 0) {
        this.cli.log(`*ЩЕЛЧОК* Кончились 10мм патроны!`, 'msg-combat');
        this.audio.playClick();
        return false;
      }
      this.inv.removeItem('10mm_ammo', 1);
    }

    this.stats.spendAp(weapon.apCost);

    if (weapon.id === '10mm_pistol') {
      this.audio.playGunshot();
    } else {
      this.audio.playHit();
    }

    const hitChance = this.calculateHitChance(target, bodyPart, weapon);
    const roll = Math.floor(Math.random() * 100) + 1;

    const partName = (bodyPart === 'head' || bodyPart === 'голова') ? 'ГОЛОВА' :
                     (bodyPart === 'legs' || bodyPart === 'ноги') ? 'НОГИ' : 'ТОРС';

    if (roll <= hitChance) {
      const isCrit = Math.random() * 100 <= this.stats.calcCritChance() || ((bodyPart === 'head' || bodyPart === 'голова') && Math.random() < 0.3);
      let rawDmg = Math.floor(Math.random() * (weapon.maxDmg - weapon.minDmg + 1)) + weapon.minDmg;

      if (bodyPart === 'head' || bodyPart === 'голова') rawDmg = Math.round(rawDmg * 2.2);
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      const finalDmg = Math.max(1, rawDmg);
      target.hp -= finalDmg;

      if (isCrit) {
        this.cli.log(`КРИТИЧЕСКИЙ УДАР по цели ${target.name} [${partName}] на ${finalDmg} УРОНА!`, 'msg-crit');
      } else {
        this.cli.log(`Попадание в ${target.name} [${partName}]: нанесен ${finalDmg} урона.`, 'msg-combat');
      }

      if (target.hp <= 0) {
        this.killEnemy(target);
      }
    } else {
      this.cli.log(`Вы целились в ${target.name} [${partName}] (${hitChance}%) и ПРОМАХНУЛИСЬ!`, 'msg-combat');
    }

    // Ответный ход врага при исчерпании ОД
    if (this.stats.ap <= 1) {
      this.enemyTurn();
      this.stats.restoreAp();
    }

    return true;
  }

  killEnemy(target) {
    this.cli.log(`${target.name} уничтожен! Получено +${target.xp} опыта.`, 'msg-crit');
    this.audio.playHit();

    // Проверка повышения уровня
    const leveled = this.stats.addXp(target.xp);
    if (leveled.length > 0) {
      leveled.forEach(lvl => {
        this.cli.log(`★★★ НОВЫЙ УРОВЕНЬ! Достигнут уровень ${lvl}! Здоровье и ОД восстановлены! ★★★`, 'msg-item');
        this.audio.playLevelUp();
      });
    }

    // Выпадение крышек
    const droppedCaps = Math.floor(Math.random() * 15) + 5;
    this.world.loot.push({
      id: Date.now(),
      x: target.x,
      y: target.y,
      items: [{ id: 'caps', name: 'Крышки от бутылок', count: droppedCaps }]
    });
  }

  enemyTurn() {
    this.world.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      const dist = Math.hypot(enemy.x - this.world.playerX, enemy.y - this.world.playerY);

      if (dist <= 6 && this.world.visible[enemy.y][enemy.x]) {
        if (dist <= 1.5) {
          // Атака игрока
          const hitRoll = Math.floor(Math.random() * 100) + 1;
          const playerAc = this.stats.calcArmorClass(this.inv.equippedArmor?.acBonus || 0);
          const hitChance = Math.max(20, 85 - playerAc);

          if (hitRoll <= hitChance) {
            let dmg = Math.floor(Math.random() * (enemy.maxDmg - enemy.minDmg + 1)) + enemy.minDmg;
            const dr = this.inv.equippedArmor?.drBonus || 0;
            dmg = Math.max(1, dmg - dr);
            const dead = this.stats.takeDamage(dmg);
            this.audio.playHit();
            this.cli.log(`${enemy.name} атакует вас и наносит ${dmg} урона! (ОЗ: ${this.stats.hp}/${this.stats.maxHp})`, 'msg-combat');
            if (dead) {
              this.cli.log(`☠ ВЫ ПОГИБЛИ В ПУСТОШАХ. ПЕРЕЗАГРУЗКА PIP-BOY...`, 'msg-crit');
            }
          } else {
            this.cli.log(`${enemy.name} бросается на вас, но промахивается!`, 'msg-combat');
          }
        } else {
          // Движение к игроку
          const stepX = Math.sign(this.world.playerX - enemy.x);
          const stepY = Math.sign(this.world.playerY - enemy.y);
          const targetX = enemy.x + stepX;
          const targetY = enemy.y + stepY;

          if (this.world.isPassable(targetX, targetY)) {
            enemy.x = targetX;
            enemy.y = targetY;
          }
        }
      }
    });
  }
}

window.CombatEngine = CombatEngine;
