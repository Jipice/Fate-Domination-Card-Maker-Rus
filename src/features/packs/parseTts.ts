// Reads a Tabletop Simulator saved object (the .json from "Saved Objects").
// Only images are used: the file stores links to them, not the pictures themselves.

type TtsCustomDeck = {
  FaceURL?: string;
  BackURL?: string;
};

type TtsObject = {
  Name?: string;
  Nickname?: string;
  CustomImage?: { ImageURL?: string };
  CustomMesh?: { DiffuseURL?: string };
  CustomDeck?: Record<string, TtsCustomDeck>;
  ContainedObjects?: TtsObject[];
};

export type PackCard = { name: string; face: string; back: string | null };
export type PackDeck = { title: string; cards: PackCard[] };
export type Pack = {
  name: string;
  token: string | null;
  figure: string | null;
  boxImage: string | null;
  decks: PackDeck[];
  singles: PackCard[];
  tiles: { name: string; image: string }[];
  cardCount: number;
};

const isHttp = (url: unknown): url is string =>
  typeof url === "string" && /^https?:\/\//.test(url);

function cardFromObject(obj: TtsObject): PackCard | null {
  const first = obj.CustomDeck ? Object.values(obj.CustomDeck)[0] : undefined;
  if (!first || !isHttp(first.FaceURL)) return null;
  return {
    name: obj.Nickname || "",
    face: first.FaceURL,
    back: isHttp(first.BackURL) ? first.BackURL : null,
  };
}

// Collects every card inside a deck, including cards nested in other containers.
function collectCards(objects: TtsObject[] | undefined): PackCard[] {
  const out: PackCard[] = [];
  for (const obj of objects ?? []) {
    if (obj.Name === "CardCustom") {
      const card = cardFromObject(obj);
      if (card) out.push(card);
    }
    out.push(...collectCards(obj.ContainedObjects));
  }
  return out;
}

export function parseTts(data: unknown): Pack | null {
  if (!data || typeof data !== "object") return null;
  const save = data as { SaveName?: string; ObjectStates?: TtsObject[] };
  const box = save.ObjectStates?.[0];
  if (!box) return null;

  const pack: Pack = {
    name: box.Nickname || save.SaveName || "Без названия",
    token: null,
    figure: null,
    boxImage: isHttp(box.CustomMesh?.DiffuseURL) ? box.CustomMesh.DiffuseURL : null,
    decks: [],
    singles: [],
    tiles: [],
    cardCount: 0,
  };

  for (const obj of box.ContainedObjects ?? []) {
    switch (obj.Name) {
      case "Deck": {
        const cards = collectCards([obj]);
        if (cards.length) {
          pack.decks.push({ title: obj.Nickname || `Колода ${pack.decks.length + 1}`, cards });
        }
        break;
      }
      case "CardCustom": {
        const card = cardFromObject(obj);
        if (card) pack.singles.push(card);
        break;
      }
      case "Custom_Token":
        if (!pack.token && isHttp(obj.CustomImage?.ImageURL)) pack.token = obj.CustomImage.ImageURL;
        break;
      case "Figurine_Custom":
        if (!pack.figure && isHttp(obj.CustomImage?.ImageURL)) pack.figure = obj.CustomImage.ImageURL;
        break;
      case "Custom_Tile":
        if (isHttp(obj.CustomImage?.ImageURL)) {
          pack.tiles.push({ name: obj.Nickname || "Плитка", image: obj.CustomImage.ImageURL });
        }
        break;
    }
  }

  pack.cardCount = pack.decks.reduce((n, d) => n + d.cards.length, 0) + pack.singles.length;
  return pack;
}
