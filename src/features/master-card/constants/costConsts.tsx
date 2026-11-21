// Типы оплаты (справа вверху карты). Чтобы добавить новый тип,
// достаточно добавить запись сюда и картинку в public/attack-card/.
export const COST_TYPES = {
  mana: {
    label: "Мана",
    image: "./attack-card/mana.png",
    blackImage: "./attack-card/mana_black.png",
    color: "#15e86f",
  },
  command: {
    label: "Командное заклинание",
    image: "./attack-card/command-spell.png",
    blackImage: "./attack-card/command-spell.png",
    color: "#c00000",
  },
} as const;

export type CostType = keyof typeof COST_TYPES;

export const getCost = (costType: CostType | null | undefined) =>
  COST_TYPES[costType ?? "mana"] ?? COST_TYPES.mana;
