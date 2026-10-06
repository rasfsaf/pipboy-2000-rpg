/**
 * Fallout S.P.E.C.I.A.L. RPG System (Русская локализация)
 * Характеристики, производные статы, навыки, лучевая болезнь, опыт и уровень.
 */

class RpgStats {
  constructor() {
    // S.P.E.C.I.A.L.
    this.special = {
      ST: 6, // Сила
      PE: 7, // Восприятие
      EN: 5, // Выносливость
      CH: 4, // Харизма
      IN: 6, // Интеллект
      AG: 8, // Ловкость
      LK: 6  // Удача
    };

    // Прогрессия
    this.level = 1;
    this.xp = 0;
    this.nextLevelXp = 1000;
    this.skillPoints = 0;

    // Выживание
    this.maxHp = this.calcMaxHp();
    this.hp = this.maxHp;
    this.maxAp = this.calcMaxAp();
    this.ap = this.maxAp;
    this.rads = 0; // 0 - 1000 рад
    this.caps = 45;

    // Навыки (в процентах %)
    this.skills = {
      smallGuns: 35 + (this.special.AG * 2), // Легкое оружие
      melee: 30 + (this.special.ST + this.special.AG), // Рукопашный бой
      firstAid: 20 + (this.special.PE + this.special.IN), // Первая помощь
      lockpick: 25 + (this.special.PE + this.special.AG), // Взлом замков
      science: 25 + (this.special.IN * 2), // Наука
      speech: 25 + (this.special.CH * 2) // Красноречие
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
    return this.special.LK;
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
    if (this.rads >= 200 && this.rads < 400) {
      return "ЛЕГКОЕ ЛУЧЕВОЕ ОТРАВЛЕНИЕ (-1 СИЛ)";
    } else if (this.rads >= 400 && this.rads < 600) {
      return "СРЕДНЕЕ ЛУЧЕВОЕ ОТРАВЛЕНИЕ (-2 СИЛ, -1 ЛОВ)";
    } else if (this.rads >= 600) {
      return "КРИТИЧЕСКОЕ ЛУЧЕВОЕ ОТРАВЛЕНИЕ (-3 СИЛ, -3 ЛОВ, -2 ВЫН)";
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
