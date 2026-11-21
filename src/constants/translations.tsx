// Русские подписи для игровых сущностей. Используются в формах и на картах.

export const ATTACK_TYPE_LABELS: Record<string, string> = {
  strength: "Сила",
  agility: "Ловкость",
  magic: "Магия",
  special: "Особая",
  noblephantasm: "Благородный фантазм",
  Strength: "Сила",
  Agility: "Ловкость",
  Magic: "Магия",
  Special: "Особая",
  "Noble Phantasm": "Благородный фантазм",
  "noble phantasm": "Благородный фантазм",
};

export const SERVANT_CLASS_LABELS: Record<string, string> = {
  Saber: "Сэйбер",
  Lancer: "Лансер",
  Archer: "Арчер",
  Rider: "Райдер",
  Caster: "Кастер",
  Assassin: "Ассасин",
  Berserker: "Берсерк",
  "Alter Ego": "Альтер-эго",
  Avenger: "Мститель",
  Beast: "Зверь",
  "Beast (Black)": "Зверь (чёрный)",
  Foreigner: "Форейнер",
  "Moon Cancer": "Лунный рак",
  Pretender: "Претендент",
  Ruler: "Правитель",
  Shielder: "Защитник",
};

export const COLOR_LABELS: Record<string, string> = {
  default: "По умолчанию",
  red: "Красный",
  green: "Зелёный",
  blue: "Синий",
  yellow: "Жёлтый",
  purple: "Фиолетовый",
};

export const CARD_TYPE_HEADERS: Record<string, string> = {
  general: "ОБЩАЯ КАРТА",
  servant: "КАРТА СЛУГИ",
  textless: "КАРТА БЕЗ ТЕКСТА",
  "textless (black)": "КАРТА БЕЗ ТЕКСТА (ЧЁРНАЯ)",
};

export const formatTimesPerGame = (times: number): string => {
  if (times === 1) return "<Один раз за игру>";
  if (times === 2) return "<Два раза за игру>";
  if (times === 3) return "<Три раза за игру>";
  const lastTwo = times % 100;
  const last = times % 10;
  let word = "раз";
  if ((lastTwo < 11 || lastTwo > 14) && last >= 2 && last <= 4) word = "раза";
  return `<${times} ${word} за игру>`;
};
