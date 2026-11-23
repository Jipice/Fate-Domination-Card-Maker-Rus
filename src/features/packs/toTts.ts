// Builds a Tabletop Simulator "saved object" (a bag with the pack inside) from a pack.
// Put the resulting .json into Documents\My Games\Tabletop Simulator\Saves\Saved Objects.
// Tabletop Simulator loads pictures only by link, so uploaded files (data:...) cannot be used.

// the model of the box (a "Custom Model Bag" in the game); its texture comes from the pack
export const BOX_MESH_URL =
  "https://steamusercontent-a.akamaihd.net/ugc/1023947675464791657/2B292629996860AAFC7A37A3CD9F38F9A72EBC19/";

// sizes taken from the packs made in the game (Adam Smasher, Kim Dokja)
const TOKEN_SCALE = 0.4; // width and depth of the token; its height stays 1
const TOKEN_THICKNESS = 0.295;
const BOX_SCALE = 2.35;

export type PackLike = {
  name: string;
  author: string | null;
  boxImage?: string | null;
  token: string | null;
  figure: string | null;
  figureBack?: string | null; // the back side of the figure (the front picture is used if empty)
  figureBase?: string | null; // colour of the figure's base, "#rrggbb"
  figureScale?: number | null; // size of the picture on the base
  defaultBack?: string | null; // back for the cards that have no back of their own
  tiles: { name: string; image: string }[];
  categories: { title: string; cards: { name: string; face: string; back: string | null }[] }[];
};

// The game multiplies pictures by this colour. The old grey 0.713 made everything darker than the original,
// so pure white (no tint) is used instead.
const WHITE = { r: 1, g: 1, b: 1 };

export const DEFAULT_FIGURE_BASE = "#ffffff";
export const DEFAULT_FIGURE_SCALE = 1.8;

export function hexToColor(hex: string | null | undefined): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return WHITE;
  const n = parseInt(m[1], 16);
  const round = (v: number) => Math.round((v / 255) * 1e6) / 1e6;
  return { r: round((n >> 16) & 255), g: round((n >> 8) & 255), b: round(n & 255) };
}

type Json = Record<string, unknown>;

const isLink = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^https?:\/\//.test(value);

// how many pictures of the pack are not links (they would be blank in the game)
export function countNonLinkImages(pack: PackLike): number {
  const all: (string | null)[] = [
    pack.token,
    pack.figure,
    pack.figureBack ?? null,
    pack.defaultBack ?? null,
    pack.boxImage ?? null,
  ];
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

  const base = (
    name: string,
    nickname: string,
    rotZ = 0,
    scale = 1,
    scaleY = scale,
    color: { r: number; g: number; b: number } = WHITE,
  ): Json => ({
    GUID: guid(),
    Name: name,
    Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ, scaleX: scale, scaleY, scaleZ: scale },
    Nickname: nickname,
    Description: "",
    GMNotes: "",
    ColorDiffuse: color,
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

  // a card without its own back gets the pack's default back, or else the first back found in the pack
  let fallbackBack: string | null = isLink(pack.defaultBack) ? pack.defaultBack : null;
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
      ...base("Custom_Token", "Жетон", 0, TOKEN_SCALE, 1),
      CustomImage: {
        ImageURL: pack.token,
        ImageSecondaryURL: "",
        ImageScalar: 1.0,
        WidthScale: 0.0,
        CustomToken: { Thickness: TOKEN_THICKNESS, MergeDistancePixels: 15.0, StandUp: false, Stackable: true },
      },
    });
  }

  if (isLink(pack.figure)) {
    contained.push({
      // the colour of a figure is the colour of its base
      ...base("Figurine_Custom", "Фигурка", 0, 1, 1, hexToColor(pack.figureBase ?? DEFAULT_FIGURE_BASE)),
      CustomImage: {
        ImageURL: pack.figure,
        ImageSecondaryURL: isLink(pack.figureBack) ? pack.figureBack : pack.figure,
        ImageScalar: pack.figureScale ?? DEFAULT_FIGURE_SCALE,
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

  // a custom box (model + texture) instead of a plain bag
  const bag: Json = {
    ...base("Custom_Model_Bag", pack.name || "Пак", 0, BOX_SCALE),
    Description: pack.author ? `Автор: ${pack.author}` : "",
    CustomMesh: {
      MeshURL: BOX_MESH_URL,
      DiffuseURL: isLink(pack.boxImage) ? pack.boxImage : "",
      NormalURL: "",
      ColliderURL: "",
      Convex: true,
      MaterialIndex: 3,
      TypeIndex: 6,
      CastShadows: true,
    },
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
