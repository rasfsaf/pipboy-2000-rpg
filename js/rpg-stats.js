/**
 * Fallout S.P.E.C.I.A.L. RPG System
 * Attributes, derived stats, skills, radiation, experience & leveling.
 */

class RpgStats {
  constructor() {
    // S.P.E.C.I.A.L.
    this.special = {
      ST: 6, // Strength
      PE: 7, // Perception
      EN: 5, // Endurance
      CH: 4, // Charisma
      IN: 6, // Intelligence
      AG: 8, // Agility
      LK: 6  // Luck
    };

    // Progression
    this.level = 1;
    this.xp = 0;
    this.nextLevelXp = 1000;
    this.skillPoints = 0;

    // Survival
    this.maxHp = this.calcMaxHp();
    this.hp = this.maxHp;
    this.maxAp = this.calcMaxAp();
    this.ap = this.maxAp;
    this.rads = 0; // 0 - 1000 rads
    this.caps = 45;

    // Skills (% based)
    this.skills = {
      smallGuns: 35 + (this.special.AG * 2),
      melee: 30 + (this.special.ST + this.special.AG),
      firstAid: 20 + (this.special.PE + this.special.IN),
      lockpick: 25 + (this.special.PE + this.special.AG),
      science: 25 + (this.special.IN * 2),
      speech: 25 + (this.special.CH * 2)
    };
  }

  calcMaxHp() {
    return 20 + (this.special.ST + (2 * this.special.EN));
  }

  calcMaxAp() {
    return 5 + Math.floor(this.special.AG / 2);
  }

  calcCarryWeight() {
    return 25 + (this.special.ST * 25);
  }

  calcArmorClass(armorBonus = 0) {
    return this.special.AG + armorBonus;
  }

  calcCritChance() {
    return this.special.LK; // Base crit % equal to Luck
  }

  addXp(amount) {
    this.xp += amount;
    const leveled = [];
    while (this.xp >= this.nextLevelXp) {
      this.level++;
      this.skillPoints += 15 + (this.special.IN * 2);
      this.maxHp = this.calcMaxHp() + ((this.level - 1) * Math.floor(this.special.EN / 2 + 2));
      this.hp = this.maxHp;
      this.ap = this.maxAp;
      this.nextLevelXp = Math.floor(this.nextLevelXp * 1.8);
      leveled.push(this.level);
    }
    return leveled;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  spendAp(amount) {
    if (this.ap >= amount) {
      this.ap -= amount;
      return true;
    }
    return false;
  }

  restoreAp(amount = null) {
    this.ap = amount !== null ? Math.min(this.maxAp, this.ap + amount) : this.maxAp;
  }

  addRads(amount) {
    this.rads = Math.min(1000, this.rads + amount);
    // Rad sickness reduces max stats if high
    if (this.rads >= 200 && this.rads < 400) {
      return "MINOR RADIATION POISONING (-1 STR)";
    } else if (this.rads >= 400 && this.rads < 600) {
      return "ADVANCED RADIATION POISONING (-2 STR, -1 AGI)";
    } else if (this.rads >= 600) {
      return "CRITICAL RADIATION POISONING (-3 STR, -3 AGI, -2 END)";
    }
    return null;
  }

  cureRads(amount) {
    this.rads = Math.max(0, this.rads - amount);
  }

  upgradeSkill(skillKey, amount = 5) {
    if (this.skillPoints >= amount && this.skills[skillKey] !== undefined) {
      this.skills[skillKey] = Math.min(100, this.skills[skillKey] + amount);
      this.skillPoints -= amount;
      return true;
    }
    return false;
  }
}

window.rpgStats = new RpgStats();
