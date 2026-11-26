// Turns a board of the extra editor into a Tabletop Simulator object.
// The object is a flat tile: its picture is the board's picture (a link, TTS cannot read files),
// and the script below makes the texts, counters, checkboxes and images work in the game.
// The stored board is kept in the object's state, so values are remembered when the game is saved.

export type ExportElement = {
  kind: "text" | "check" | "image" | "snap";
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  values: (string | number)[];
  font: number;
  align: "left" | "center" | "right";
  color: string;
  bgOn: boolean;
  bg: string;
  counter: boolean;
  size: number;
  url: string;
  rotation: number;
  name: string;
  locked: boolean;
};

export type ExportBoard = {
  name: string;
  width: number;
  height: number;
  elements: ExportElement[];
};

// Lua script of the object. Draft: check it in the game and tell what does not work.
const LUA = `
local S = nil
local W, H = 1, 1
local vals = {}
local inputIndex = {}
local nInputs = 0
local buttonCount = 0
local CHECK = {[0] = "◌", [1] = "○", [2] = "●"}

local function save()
  if S ~= nil then
    for k, el in ipairs(S.elements) do
      el.values = vals[k]
    end
    self.script_state = JSON.encode(S)
  end
end

local function hex2rgb(hex)
  if hex == nil or hex == "" then return {r = 0, g = 0, b = 0} end
  local r = tonumber(string.sub(hex, 2, 3), 16) or 0
  local g = tonumber(string.sub(hex, 4, 5), 16) or 0
  local b = tonumber(string.sub(hex, 6, 7), 16) or 0
  return {r = r / 255, g = g / 255, b = b / 255}
end

-- board point (px, py) -> position on the tile
local function pos(px, py)
  local sx, sz = self.getScale().x, self.getScale().z
  return {x = (px / W - 0.5) * sx, y = 0.12, z = (py / H - 0.5) * sz}
end

function onLoad(saved)
  local raw = self.script_state
  if raw == nil or raw == "" then raw = saved end
  if raw ~= nil and raw ~= "" then S = JSON.decode(raw) end
  if S == nil or S.elements == nil then return end
  W, H = S.width, S.height
  for k, el in ipairs(S.elements) do
    vals[k] = el.values or {}
  end
  build()
end

function build()
  -- TTS units per board pixel (the tile is 4 units wide)
  local K = (self.getScale().x / W) * 1000
  self.clearInputs()
  self.clearButtons()
  inputIndex = {}
  nInputs = 0
  buttonCount = 0
  local decals = {}
  local sx, sz = self.getScale().x, self.getScale().z

  for k, el in ipairs(S.elements) do
    if el.kind == "text" then
      inputIndex[k] = {}
      for i = 1, el.cols * el.rows do
        local col = (i - 1) % el.cols
        local row = math.floor((i - 1) / el.cols)
        local px = el.x + col * (el.w + el.gapX) + el.w / 2
        local py = el.y + row * (el.h + el.gapY) + el.h / 2
        local fname = "tx_" .. k .. "_" .. i
        _G[fname] = function(obj, color, value, selected)
          vals[k][i] = value
          save()
        end
        local bg = {r = 0, g = 0, b = 0, a = 0}
        if el.bgOn then
          local c = hex2rgb(el.bg)
          bg = {r = c.r, g = c.g, b = c.b, a = 1}
        end
        local c = hex2rgb(el.color)
        self.createInput({
          input_function = fname,
          function_owner = self,
          value = tostring(vals[k][i] or ""),
          position = pos(px, py),
          rotation = {x = 0, y = 0, z = 0},
          width = el.w * K,
          height = el.h * K,
          font_size = el.font * K * 0.6,
          font_color = {r = c.r, g = c.g, b = c.b, a = 1},
          color = bg,
          alignment = 3,
          tab = 2,
        })
        nInputs = nInputs + 1
        inputIndex[k][i] = nInputs

        if el.counter then
          local cname = "cnt_" .. k .. "_" .. i
          local function bump(delta)
            _G[cname] = nil
            local cur = tonumber(vals[k][i]) or 0
            vals[k][i] = tostring(cur + delta)
            self.editInput({index = inputIndex[k][i] - 1, value = vals[k][i]})
            save()
          end
          _G[cname .. "_up"] = function() bump(1) end
          _G[cname .. "_down"] = function() bump(-1) end
          self.createButton({
            click_function = cname .. "_up", function_owner = self, label = "+",
            position = {x = pos(px + el.w / 2 + 14, py).x, y = 0.12, z = pos(px, py).z - el.h / 4},
            width = 220, height = 220, font_size = 180,
            font_color = {r = 1, g = 1, b = 1, a = 1}, color = {r = 0.2, g = 0.5, b = 0.8, a = 1},
          })
          self.createButton({
            click_function = cname .. "_down", function_owner = self, label = "-",
            position = {x = pos(px + el.w / 2 + 14, py).x, y = 0.12, z = pos(px, py).z + el.h / 4},
            width = 220, height = 220, font_size = 180,
            font_color = {r = 1, g = 1, b = 1, a = 1}, color = {r = 0.2, g = 0.5, b = 0.8, a = 1},
          })
          buttonCount = buttonCount + 2
        end
      end

    elseif el.kind == "check" then
      inputIndex[k] = {}
      for i = 1, el.cols * el.rows do
        local col = (i - 1) % el.cols
        local row = math.floor((i - 1) / el.cols)
        local px = el.x + col * (el.w + el.gapX) + el.w / 2
        local py = el.y + row * (el.h + el.gapY) + el.h / 2
        local fname = "ck_" .. k .. "_" .. i
        _G[fname] = function(obj, color, alt)
          local v = tonumber(vals[k][i]) or 1
          if alt then
            vals[k][i] = (v == 0) and 1 or 0
          else
            vals[k][i] = (v == 1) and 2 or 1
          end
          self.editButton({index = inputIndex[k][i] - 1, label = CHECK[tonumber(vals[k][i]) or 1]})
          save()
        end
        local c = hex2rgb(el.color)
        self.createButton({
          click_function = fname, function_owner = self,
          label = CHECK[tonumber(vals[k][i]) or 1],
          position = pos(px, py), rotation = {x = 0, y = 0, z = 0},
          width = el.w * K, height = el.h * K, font_size = el.size * K * 0.6,
          font_color = {r = c.r, g = c.g, b = c.b, a = 1}, color = {r = 0, g = 0, b = 0, a = 0},
        })
        buttonCount = buttonCount + 1
        inputIndex[k][i] = buttonCount
      end

    elseif el.kind == "image" and el.url ~= nil and el.url ~= "" then
      table.insert(decals, {
        name = el.name or "Картинка",
        url = el.url,
        position = pos(el.x + el.w / 2, el.y + el.h / 2),
        rotation = {x = 90, y = el.rotation or 0, z = 0},
        scale = {x = el.w / W * sx, y = el.h / H * sz, z = 1},
      })
    end
  end

  self.setDecals(decals)
end
`;

export function sheetToTts(board: ExportBoard, imageUrl: string): Record<string, unknown> {
  const guid = Math.random().toString(16).slice(2, 8);
  // The state goes into the object, so keep it small: no picture data (the picture is the tile's link),
  // and no inline pictures from the elements either.
  const slim = {
    ...board,
    elements: board.elements.map((e) => ({ ...e, url: e.url.startsWith("data:") ? "" : e.url })),
  } as ExportBoard & Record<string, unknown>;
  delete (slim as Record<string, unknown>).background;
  const state = JSON.stringify(slim);
  const ratio = board.height / board.width;
  // snap points: where a piece clicks onto the tile (centre of each point, tile is 4 x 4*ratio units)
  // TTS keeps snap points of an object in AttachedSnapPoints, each one only has a Position
  const snapPoints = board.elements
    .filter((e) => e.kind === "snap")
    .map((e) => ({
      Position: {
        x: ((e.x + e.w / 2) / board.width - 0.5) * 4,
        y: 0.2,
        z: ((e.y + e.h / 2) / board.height - 0.5) * 4 * ratio,
      },
    }));
  return {
    SaveName: board.name,
    ObjectStates: [
      {
        GUID: guid,
        Name: "Custom_Tile",
        Nickname: board.name,
        Description: "Доп. Редактор",
        Transform: {
          posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 0,
          scaleX: 4, scaleY: 1, scaleZ: 4 * ratio,
        },
        CustomImage: {
          ImageURL: imageUrl,
          ImageSecondaryURL: "",
          ImageScalar: 1,
          WidthScale: 0,
          CustomTile: { Type: 0, Thickness: 0.2, Stackable: false, Stretch: true },
        },
        LuaScript: LUA,
        LuaScriptState: state,
        ...(snapPoints.length > 0 ? { AttachedSnapPoints: snapPoints } : {}),
      },
    ],
  };
}
