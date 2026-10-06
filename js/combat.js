/**
 * Fallout Turn-Based Combat & VATS Targeting Engine
 * Calculates hit probability, critical strikes, body part damage and enemy AI turns.
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
      return 0; // Out of melee range
    }

    let partModifier = 0;
    if (bodyPart === 'head') partModifier = -25;
    if (bodyPart === 'legs') partModifier = -10;
    if (bodyPart === 'torso') partModifier = 10;

    const baseChance = skillVal + (this.stats.special.PE * 4) + partModifier - target.ac - penalty;
    return Math.max(5, Math.min(95, Math.round(baseChance)));
  }

  attackTarget(target, bodyPart = 'torso') {
    const weapon = this.inv.equippedWeapon || { name: 'Fists', minDmg: 1, maxDmg: 3, apCost: 2, range: 1 };
    
    // Check AP
    if (this.stats.ap < weapon.apCost) {
      this.cli.log(`Not enough Action Points! Need ${weapon.apCost} AP, have ${this.stats.ap} AP.`, 'msg-combat');
      return false;
    }

    // Check Ammo
    if (weapon.id === '10mm_pistol') {
      const ammo = this.inv.getItem('10mm_ammo');
      if (!ammo || ammo.count <= 0) {
        this.cli.log(`*CLICK* Out of 10mm Ammo!`, 'msg-combat');
        this.audio.playClick();
        return false;
      }
      this.inv.removeItem('10mm_ammo', 1);
    }

    this.stats.spendAp(weapon.apCost);

    // Audio SFX
    if (weapon.id === '10mm_pistol') {
      this.audio.playGunshot();
    } else {
      this.audio.playHit();
    }

    const hitChance = this.calculateHitChance(target, bodyPart, weapon);
    const roll = Math.floor(Math.random() * 100) + 1;

    if (roll <= hitChance) {
      // Hit! Check Crit
      const isCrit = Math.random() * 100 <= this.stats.calcCritChance() || (bodyPart === 'head' && Math.random() < 0.3);
      let rawDmg = Math.floor(Math.random() * (weapon.maxDmg - weapon.minDmg + 1)) + weapon.minDmg;

      if (bodyPart === 'head') rawDmg = Math.round(rawDmg * 2.2);
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      const finalDmg = Math.max(1, rawDmg);
      target.hp -= finalDmg;

      if (isCrit) {
        this.cli.log(`CRITICAL HIT on ${target.name} [${bodyPart.toUpperCase()}] for ${finalDmg} DMG!`, 'msg-crit');
      } else {
        this.cli.log(`Hit ${target.name} [${bodyPart.toUpperCase()}] for ${finalDmg} DMG.`, 'msg-combat');
      }

      if (target.hp <= 0) {
        this.killEnemy(target);
      }
    } else {
      this.cli.log(`You aimed at ${target.name} [${bodyPart.toUpperCase()}] (${hitChance}%) and MISSED!`, 'msg-combat');
    }

    // Trigger enemy retaliation if still alive and player has 0 AP
    if (this.stats.ap <= 1) {
      this.enemyTurn();
      this.stats.restoreAp();
    }

    return true;
  }

  killEnemy(target) {
    this.cli.log(`${target.name} was slaughtered! Gained +${target.xp} XP.`, 'msg-crit');
    this.audio.playHit();

    // Check for level up
    const leveled = this.stats.addXp(target.xp);
    if (leveled.length > 0) {
      leveled.forEach(lvl => {
        this.cli.log(`★★★ LEVEL UP! Reached Level ${lvl}! AP & HP restored! ★★★`, 'msg-item');
        this.audio.playLevelUp();
      });
    }

    // Drop loot at corpse position
    this.world.loot.push({
      id: Date.now(),
      x: target.x,
      y: target.y,
      items: [{ id: 'caps', name: 'Bottle Caps', count: Math.floor(Math.random() * 15) + 5 }]
    });
  }

  enemyTurn() {
    this.world.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      const dist = Math.hypot(enemy.x - this.world.playerX, enemy.y - this.world.playerY);

      if (dist <= 6 && this.world.visible[enemy.y][enemy.x]) {
        if (dist <= 1.5) {
          // Attack player
          const hitRoll = Math.floor(Math.random() * 100) + 1;
          const playerAc = this.stats.calcArmorClass(this.inv.equippedArmor?.acBonus || 0);
          const hitChance = Math.max(20, 85 - playerAc);

          if (hitRoll <= hitChance) {
            let dmg = Math.floor(Math.random() * (enemy.maxDmg - enemy.minDmg + 1)) + enemy.minDmg;
            const dr = this.inv.equippedArmor?.drBonus || 0;
            dmg = Math.max(1, dmg - dr);
            const dead = this.stats.takeDamage(dmg);
            this.audio.playHit();
            this.cli.log(`${enemy.name} strikes you for ${dmg} DMG! (HP: ${this.stats.hp}/${this.stats.maxHp})`, 'msg-combat');
            if (dead) {
              this.cli.log(`☠ YOU HAVE DIED IN THE WASTELAND. REBOOTING PIP-BOY...`, 'msg-crit');
            }
          } else {
            this.cli.log(`${enemy.name} lunges at you and misses!`, 'msg-combat');
          }
        } else {
          // Move towards player
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
