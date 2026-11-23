// Builds a Tabletop Simulator "saved object" (a bag with the pack inside) from a pack.
// Put the resulting .json into Documents\My Games\Tabletop Simulator\Saves\Saved Objects.
// Tabletop Simulator loads pictures only by link, so uploaded files (data:...) cannot be used.

export type PackLike = {
  name: string;
  author: string | null;
  token: string | null;
  figure: string | null;
  tiles: { name: string; image: string }[];
  categories: { title: string; cards: { name: string; face: string; back: string | null }[] }[];
};

type Json = Record<string, unknown>;

const isLink = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^https?:\/\//.test(value);

// how many pictures of the pack are not links (they would be blank in the game)
export function countNonLinkImages(pack: PackLike): number {
  const all: (string | null)[] = [pack.token, pack.figure];
  for (const tile of pack.tiles) all.push(tile.image);
  for (const cat of pack.categories) {
    for (const card of cat.cards) all.push(card.face, card.back);
  }
  return all.filter((v) => !!v && !isLink(v)).length;
}

export function toTts(pack: PackLike): Json {
  const used = new Set<string>();
  const guid = () => {
    let g: string;
    do {
      g = Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0");
    } while (used.has(g));
    used.add(g);
    return g;
  };

  const base = (name: string, nickname: string, rotZ = 0): Json => ({
    GUID: guid(),
    Name: name,
    Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ, scaleX: 1, scaleY: 1, scaleZ: 1 },
    Nickname: nickname,
    Description: "",
    GMNotes: "",
    ColorDiffuse: { r: 0.713235259, g: 0.713235259, b: 0.713235259 },
    Locked: false,
    Grid: true,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: false,
    Hands: false,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: "",
  });

  // a card without its own back gets the first back found in the pack
  let fallbackBack: string | null = null;
  for (const cat of pack.categories) {
    for (const card of cat.cards) {
      if (!fallbackBack && isLink(card.back)) fallbackBack = card.back;
    }
  }

  // every card is its own 1x1 "sheet", numbered across the whole pack
  let sheetNo = 0;
  const makeCard = (
    card: { name: string; face: string; back: string | null },
    rotZ: number,
  ): { id: number; key: string; sheet: Json; object: Json } => {
    sheetNo += 1;
    const key = String(sheetNo);
    const id = sheetNo * 100;
    const sheet: Json = {
      FaceURL: card.face,
      BackURL: isLink(card.back) ? card.back : (fallbackBack ?? card.face),
      NumWidth: 1,
      NumHeight: 1,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0,
    };
    const object: Json = {
      ...base("CardCustom", card.name, rotZ),
      HideWhenFaceDown: true,
      Hands: true,
      CardID: id,
      SidewaysCard: false,
      CustomDeck: { [key]: sheet },
    };
    return { id, key, sheet, object };
  };

  const contained: Json[] = [];

  for (const cat of pack.categories) {
    const cards = cat.cards.filter((c) => isLink(c.face));
    if (cards.length === 0) continue;

    // the game has no deck of one card, so a lone card is put in as a card
    if (cards.length === 1) {
      contained.push(makeCard(cards[0], 0).object);
      continue;
    }

    const made = cards.map((c) => makeCard(c, 180));
    const customDeck: Record<string, Json> = {};
    for (const m of made) customDeck[m.key] = m.sheet;
    contained.push({
      ...base("Deck", cat.title, 180),
      HideWhenFaceDown: true,
      SidewaysCard: false,
      DeckIDs: made.map((m) => m.id),
      CustomDeck: customDeck,
      ContainedObjects: made.map((m) => m.object),
    });
  }

  if (isLink(pack.token)) {
    contained.push({
      ...base("Custom_Token", "Жетон"),
      CustomImage: {
        ImageURL: pack.token,
        ImageSecondaryURL: "",
        ImageScalar: 1.0,
        WidthScale: 0.0,
        CustomToken: { Thickness: 0.2, MergeDistancePixels: 15.0, StandUp: false, Stackable: false },
      },
    });
  }

  if (isLink(pack.figure)) {
    contained.push({
      ...base("Figurine_Custom", "Фигурка"),
      CustomImage: {
        ImageURL: pack.figure,
        ImageSecondaryURL: pack.figure,
        ImageScalar: 1.0,
        WidthScale: 0.0,
        CustomToken: { Thickness: 0.2, MergeDistancePixels: 15.0, StandUp: false, Stackable: false },
      },
    });
  }

  for (const tile of pack.tiles) {
    if (!isLink(tile.image)) continue;
    contained.push({
      ...base("Custom_Tile", tile.name || "Плитка"),
      CustomImage: {
        ImageURL: tile.image,
        ImageSecondaryURL: "",
        ImageScalar: 1.0,
        WidthScale: 0.0,
        CustomTile: { Type: 0, Thickness: 0.2, Stackable: false, Stretch: true },
      },
    });
  }

  const bag: Json = {
    ...base("Bag", pack.name || "Пак"),
    Description: pack.author ? `Автор: ${pack.author}` : "",
    ContainedObjects: contained,
  };

  return {
    SaveName: pack.name || "Пак",
    GameMode: "",
    Gravity: 0.5,
    PlayArea: 0.5,
    Date: "",
    Table: "",
    Sky: "",
    Note: "",
    TabStates: {},
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: "",
    ObjectStates: [bag],
  };
}
