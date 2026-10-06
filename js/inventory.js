/**
 * Fallout Inventory & Equipment System (Русская локализация)
 * Управление оружием, броней, стимпаками, патронами, крышками и слотами экипировки.
 */

class InventoryManager {
  constructor(stats) {
    this.stats = stats;
    this.items = [
      { id: '10mm_pistol', name: '10мм Пистолет', type: 'weapon', minDmg: 7, maxDmg: 12, apCost: 4, range: 6, weight: 3, value: 65, count: 1, desc: 'Надежный полуавтоматический пистолет пустоши.' },
      { id: 'combat_knife', name: 'Боевой нож', type: 'weapon', minDmg: 4, maxDmg: 8, apCost: 3, range: 1, weight: 1, value: 30, count: 1, desc: 'Армейский клинок из высокоуглеродистой стали.' },
      { id: 'leather_jacket', name: 'Кожаная куртка', type: 'armor', acBonus: 5, drBonus: 2, weight: 5, value: 80, count: 1, desc: 'Классическая черная байкерская куртка Пустоши.' },
      { id: 'stimpak', name: 'Стимпак', type: 'med', heal: 25, weight: 0.5, value: 25, count: 4, desc: 'Довоенный инъектор с целебным раствором.' },
      { id: 'radaway', name: 'Антирадин (RadAway)', type: 'med', radHeal: 60, weight: 0.5, value: 40, count: 2, desc: 'Очищает кровь от радиоактивного заражения.' },
      { id: 'nuka_cola', name: 'Ядер-Кола', type: 'food', heal: 8, rads: 3, weight: 1, value: 10, count: 3, desc: 'Теплый газированный напиток с легкой радиацией.' },
      { id: '10mm_ammo', name: 'Патроны 10мм JHP', type: 'ammo', weight: 0.05, value: 2, count: 36, desc: 'Экспансивные патроны 10мм в металлической гильзе.' }
    ];

    this.equippedWeapon = this.items[0]; // 10mm Пистолет
    this.equippedArmor = this.items[2];  // Кожаная куртка
  }

  getTotalWeight() {
    return this.items.reduce((sum, item) => sum + (item.weight * item.count), 0);
  }

  getItem(id) {
    return this.items.find(i => i.id === id);
  }

  findItemByName(query) {
    const q = query.toLowerCase().trim();
    return this.items.find(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
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
      return this.equippedWeapon ? `Экипировано оружие: ${item.name}` : `Оружие снято`;
    }
    if (item.type === 'armor') {
      this.equippedArmor = this.equippedArmor?.id === item.id ? null : item;
      return this.equippedArmor ? `Надета броня: ${item.name}` : `Броня снята`;
    }
    return null;
  }

  useItem(item) {
    if (item.type === 'med') {
      if (item.heal) {
        this.stats.heal(item.heal);
        this.removeItem(item.id, 1);
        return `Применен ${item.name}. Восстановлено +${item.heal} ОЗ. (Здоровье: ${this.stats.hp}/${this.stats.maxHp})`;
      }
      if (item.radHeal) {
        this.stats.cureRads(item.radHeal);
        this.removeItem(item.id, 1);
        return `Применен ${item.name}. Снято -${item.radHeal} Рад. (Радиация: ${this.stats.rads} рад)`;
      }
    } else if (item.type === 'food') {
      this.stats.heal(item.heal || 0);
      if (item.rads) this.stats.addRads(item.rads);
      this.stats.caps += 1;
      this.removeItem(item.id, 1);
      return `Выпита ${item.name}! +${item.heal} ОЗ, +${item.rads} Рад, +1 Крышка!`;
    } else if (item.type === 'weapon' || item.type === 'armor') {
      return this.equip(item);
    }
    return `Нельзя использовать ${item.name} напрямую.`;
  }
}

window.inventoryManager = new InventoryManager(window.rpgStats);
