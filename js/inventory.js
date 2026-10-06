/**
 * Fallout Inventory & Equipment System
 * Manage weapons, armor, stimpaks, ammo, caps and equipment slots.
 */

class InventoryManager {
  constructor(stats) {
    this.stats = stats;
    this.items = [
      { id: '10mm_pistol', name: '10mm Pistol', type: 'weapon', minDmg: 7, maxDmg: 12, apCost: 4, range: 6, weight: 3, value: 65, count: 1, desc: 'Reliable semi-automatic handgun.' },
      { id: 'combat_knife', name: 'Combat Knife', type: 'weapon', minDmg: 4, maxDmg: 8, apCost: 3, range: 1, weight: 1, value: 30, count: 1, desc: 'High-carbon steel combat blade.' },
      { id: 'leather_jacket', name: 'Leather Jacket', type: 'armor', acBonus: 5, drBonus: 2, weight: 5, value: 80, count: 1, desc: 'Mad Max-style black motorcycle jacket.' },
      { id: 'stimpak', name: 'Stimpak', type: 'med', heal: 25, weight: 0.5, value: 25, count: 4, desc: 'Standard pre-war healing syringe.' },
      { id: 'radaway', name: 'RadAway', type: 'med', radHeal: 60, weight: 0.5, value: 40, count: 2, desc: 'Purges radiation contamination from blood.' },
      { id: 'nuka_cola', name: 'Nuka-Cola', type: 'food', heal: 8, rads: 3, weight: 1, value: 10, count: 3, desc: 'Warm, radioactive carbonated soft drink.' },
      { id: '10mm_ammo', name: '10mm JHP Ammo', type: 'ammo', weight: 0.05, value: 2, count: 36, desc: 'Jacketed hollow point 10mm rounds.' }
    ];

    this.equippedWeapon = this.items[0]; // 10mm Pistol
    this.equippedArmor = this.items[2];  // Leather Jacket
  }

  getTotalWeight() {
    return this.items.reduce((sum, item) => sum + (item.weight * item.count), 0);
  }

  getItem(id) {
    return this.items.find(i => i.id === id);
  }

  addItem(itemData) {
    const existing = this.getItem(itemData.id);
    if (existing) {
      existing.count += (itemData.count || 1);
    } else {
      this.items.push({ ...itemData, count: itemData.count || 1 });
    }
  }

  removeItem(id, count = 1) {
    const item = this.getItem(id);
    if (!item) return false;
    item.count -= count;
    if (item.count <= 0) {
      this.items = this.items.filter(i => i.id !== id);
      if (this.equippedWeapon && this.equippedWeapon.id === id) this.equippedWeapon = null;
      if (this.equippedArmor && this.equippedArmor.id === id) this.equippedArmor = null;
    }
    return true;
  }

  equip(item) {
    if (item.type === 'weapon') {
      this.equippedWeapon = this.equippedWeapon?.id === item.id ? null : item;
      return this.equippedWeapon ? `Equipped ${item.name}` : `Unequipped weapon`;
    }
    if (item.type === 'armor') {
      this.equippedArmor = this.equippedArmor?.id === item.id ? null : item;
      return this.equippedArmor ? `Equipped ${item.name}` : `Unequipped armor`;
    }
    return null;
  }

  useItem(item) {
    if (item.type === 'med') {
      if (item.heal) {
        this.stats.heal(item.heal);
        this.removeItem(item.id, 1);
        return `Used ${item.name}. Restored ${item.heal} HP. (HP: ${this.stats.hp}/${this.stats.maxHp})`;
      }
      if (item.radHeal) {
        this.stats.cureRads(item.radHeal);
        this.removeItem(item.id, 1);
        return `Used ${item.name}. Purged ${item.radHeal} Rads. (Rads: ${this.stats.rads} rads)`;
      }
    } else if (item.type === 'food') {
      this.stats.heal(item.heal || 0);
      if (item.rads) this.stats.addRads(item.rads);
      this.stats.caps += 1; // You get a cap!
      this.removeItem(item.id, 1);
      return `Drank ${item.name}! +${item.heal} HP, +${item.rads} Rads, +1 Bottle Cap!`;
    } else if (item.type === 'weapon' || item.type === 'armor') {
      return this.equip(item);
    }
    return `Cannot use ${item.name} directly.`;
  }
}

window.inventoryManager = new InventoryManager(window.rpgStats);
