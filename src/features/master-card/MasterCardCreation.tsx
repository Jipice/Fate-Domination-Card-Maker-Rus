"use client";

import { COST_TYPES, CostType } from "./constants/costConsts";
import { ATTACK_TYPE_LABELS } from "@/src/constants/translations";
import React, { useState } from "react";
import { Card } from "./Canvas";
import { ExportImportFeature } from "./components/buttons/ExportImportButtons";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { ATTACK_TYPES } from "@/src/constants/servantConstants";
import {
  formInput,
  MAIN_CARD,
} from "@/src/features/master-card/types/formTypes";
import { updateForm } from "@/src/utils/formUtils";
import "./styles/master-card-creation.scss";
import { ClearFormButton } from "../../components/header/ClearFormButton";
import { PageName } from "../../components/header/PageName";
import { DownloadButton } from "../../components/buttons/DownloadButton";
import ColorInput from "../master-assets/components/ColorInput";
import { Color } from "@/src/types/colorTypes";
import CardColorInput from "./components/form/CardColorInput";
import { CARD_COLORS } from "./constants/formConsts";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";
import CardSettings from "./components/CardSettings";
import { NAME_FIELD_SIZES } from "@/src/constants/formConstants";
import NameLength from "@/src/components/form/NameLength";

const emptyState: formInput = {
  pic: null,
  masterName: "",
  masterNameColor: "#ffffff" as Color,
  masterNameFontSize: 50,
  objectiveValue: null,
  eventMana: null,
  cardAttack: null,
  cardMana: null,
  costType: "mana",
  attackTypes: {
    strength: false,
    agility: false,
    magic: false,
    special: false,
    noblephantasm: false,
  },
  masterAbility: "",
  grayscaleFilter: false,
  servantClass: null,
  servantCards: [
    { index: 0, cardType: "Strength", values: "", showIcon: true },
    { index: 1, cardType: "Agility", values: "", showIcon: true },
    { index: 2, cardType: "Magic", values: "", showIcon: true },
  ],
  servantCardsSpecialFontSize: 36,
  hasCardAbility: true,
  revealServantName: false,
  timesPerGame: null,
  masterNameFieldSize: NAME_FIELD_SIZES.short,
  cardColorSettings: CARD_COLORS.default,
  cardToMake: MAIN_CARD.general,
  blackTextlessTypes: {
    strength: false,
    agility: false,
    magic: false,
    special: false,
    noblephantasm: false,
  },
};

const initialState = {
  ...emptyState,
  servantCards: [
    { index: 0, cardType: "Strength", values: "", showIcon: true },
    { index: 1, cardType: "Agility", values: "", showIcon: true },
    { index: 2, cardType: "Magic", values: "", showIcon: true },
  ],
  masterName: "Название карты",
  masterAbility: `<p><span style="color: #ffffff; font-size: 30px; line-height: 1.1;"><em>Пример</em> — добавьте способности!</span></p>
  <p><span style="color: #ffffff; font-size: 30px; line-height: 1.1;"><em>Другой пример</em> — <strong>Пассивная способность/Действие:</strong> заплатите 1 ману, чтобы [выполнить действие].</span></p>`,
};

export const MasterCardCreation = () => {
  const [form, setForm] = useState<formInput>(initialState);

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const mainUpdateForm = <K extends keyof formInput>(
    key: K,
    value: formInput[K] | ((prev: formInput[K]) => formInput[K]),
  ) => {
    updateForm(key, value, setForm);
  };

  const getEventOrObjectiveValue = (value: string): "X" | number | null => {
    if (value === "X") return "X";
    if (value === "") return null;

    const numberValue = Number(value);

    return numberValue >= 0 && numberValue <= 9 ? numberValue : null;
  };

  const handleAttackTypeChange = (index: string) => {
    mainUpdateForm("attackTypes", {
      ...form.attackTypes,
      [index]: !form.attackTypes[index],
    });
  };

  const updateName = (value: NAME_FIELD_SIZES) => {
    mainUpdateForm("masterNameFieldSize", value);
  };

  return (
    <div className="flex-col w-full flex">
      <div className="flex flex-col xl:flex-row">
        <div className="xl:w-1/2 flex flex-col justify-between">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <PageName />
            <span className="flex gap-2">
              <ClearFormButton setForm={setForm} emptyState={emptyState} />
              <ExportImportFeature form={form} setForm={setForm} />
            </span>
          </div>
          <hr className="my-3" />
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col items-start">
              <h2 className="category-header">ОСНОВНОЕ</h2>
              {/* Name */}
              <div className="input-block flex gap-2 flex-col">
                <span>
                  <label htmlFor="masterName" className="field-header">
                    Название карты
                  </label>
                  <div className="flex flex-row align-center gap-3">
                    <input
                      type="text"
                      id="masterName"
                      name="masterName"
                      value={form.masterName ?? ""}
                      onChange={(e) =>
                        mainUpdateForm("masterName", e.target.value)
                      }
                    />
                    {/* Name Font Size */}
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          mainUpdateForm(
                            "masterNameFontSize",
                            form.masterNameFontSize - 2,
                          )
                        }
                        className="w-9 h-9 flex items-center justify-center border border-black cursor-pointer text-xl bg-blue-900 hover:bg-blue-700 rounded-l"
                        title="Уменьшить шрифт"
                      >
                        <MdTextDecrease />
                      </button>

                      <div
                        className="w-11 h-9 flex items-center justify-center border border-black bg-blue-500 text-center"
                        style={{ marginLeft: -1 }}
                      >
                        <div className="text-sm">
                          {form.masterNameFontSize}px
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          mainUpdateForm(
                            "masterNameFontSize",
                            form.masterNameFontSize + 2,
                          )
                        }
                        className="w-9 h-9 flex items-center justify-center border border-black cursor-pointer text-xl bg-blue-900 hover:bg-blue-700 rounded-r"
                        title="Увеличить шрифт"
                        style={{ marginLeft: -1 }}
                      >
                        <MdTextIncrease />
                      </button>
                    </div>
                  </div>
                </span>
                <NameLength
                  nameFieldSize={form.masterNameFieldSize}
                  updateForm={updateName}
                />
                <div>
                  <div>
                    <ColorInput
                      label={"Цвет имени"}
                      value={form.masterNameColor ?? emptyState.masterNameColor}
                      handleValue={(color: string) =>
                        setForm((prev) => ({
                          ...prev,
                          masterNameColor: color as Color,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col input-block">
                <label htmlFor="optionDropdown" className="field-header">
                  Тип карты [Общая - Слуга - Без текста]
                </label>
                <select
                  id="optionDropdown"
                  name="optionDropdown"
                  value={form.cardToMake ?? MAIN_CARD.general}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      cardToMake: e.target.value as MAIN_CARD,
                    }));
                  }}
                >
                  <option value={MAIN_CARD.general}>
                    Общая (атаки, мастера...)
                  </option>
                  <option value={MAIN_CARD.servant}>Карта слуги</option>
                  <option value={MAIN_CARD.textless}>Карта без текста</option>
                  <option value={MAIN_CARD.textlessBlack}>Карта без текста (чёрная)</option>
                </select>
              </div>

              <CardSettings
                cardType={form.cardToMake}
                form={form}
                setForm={setForm}
              />
            </div>

            {/* Everything Else */}
            <div className="grid grid-cols-2">
              <div className="flex flex-col">
                <span className="category-header">Мана и атака</span>
                {/* Mana */}
                <div className="flex flex-col items-start input-block">
                  <label htmlFor="costType" className="field-header">
                    Оплата
                  </label>
                  <select
                    id="costType"
                    name="costType"
                    value={form.costType ?? "mana"}
                    onChange={(e) =>
                      mainUpdateForm("costType", e.target.value as CostType)
                    }
                  >
                    {Object.entries(COST_TYPES).map(([key, cost]) => (
                      <option key={key} value={key}>
                        {cost.label}
                      </option>
                    ))}
                  </select>
                  <input
                    id="manaInput"
                    name="manaInput"
                    type="text"
                    maxLength={2}
                    value={form.cardMana ?? ""}
                    placeholder={"Пусто, X или 1–2 цифры"}
                    onChange={(e) =>
                      mainUpdateForm(
                        "cardMana",
                        e.target.value.toUpperCase() || null,
                      )
                    }
                  />
                </div>
                {/* Attack */}
                <div className="flex flex-col items-start input-block">
                  <label htmlFor="attackInput" className="field-header">
                    Атака
                  </label>
                  <input
                    id="attackInput"
                    name="attackInput"
                    type="text"
                    maxLength={2}
                    value={form.cardAttack ?? ""}
                    placeholder={"Пусто, X или 1–2 цифры"}
                    onChange={(e) =>
                      mainUpdateForm(
                        "cardAttack",
                        e.target.value.toUpperCase() || null,
                      )
                    }
                  />
                </div>
                {/* Attack Types (top left) */}
                <div className="flex flex-col input-block">
                  <h2 className="category-header">Типы атаки</h2>
                  {ATTACK_TYPES.map((type, i) => (
                    <label key={i} className="flex gap-1">
                      <input
                        id={"attackType" + i}
                        type="checkbox"
                        checked={form.attackTypes[type.toLowerCase().replaceAll(' ', '')] ?? false}
                        onChange={() =>
                          handleAttackTypeChange(type.toLowerCase().replaceAll(' ', ''))
                        }
                      />
                      {ATTACK_TYPE_LABELS[type] ?? type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="category-header">СОБЫТИЯ И ЦЕЛИ</span>
                <div className="input-block flex flex-col items-start">
                  <label className="field-header" htmlFor="eventMana">
                    Мана события
                  </label>
                  <select
                    id="eventMana"
                    name="eventMana"
                    value={form.eventMana ?? ""}
                    onChange={(e) =>
                      mainUpdateForm(
                        "eventMana",
                        getEventOrObjectiveValue(e.target.value),
                      )
                    }
                  >
                    <option value="">Нет</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                    <option key="X" value={"X"}>
                      X
                    </option>
                  </select>
                </div>

                <div className="input-block flex flex-col items-start">
                  <label className="field-header" htmlFor="objective">
                    Очки цели
                  </label>
                  <select
                    id="objective"
                    name="objective"
                    value={form.objectiveValue ?? ""}
                    onChange={(e) =>
                      mainUpdateForm(
                        "objectiveValue",
                        getEventOrObjectiveValue(e.target.value),
                      )
                    }
                  >
                    <option value="">Нет</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                    <option key="X" value={"X"}>
                      X
                    </option>
                  </select>
                </div>

                <div>
                  <span className="category-header">ПРОЧИЕ НАСТРОЙКИ</span>
                  <div className="input-block">
                    <label className="field-header" htmlFor="grayscaleFilter">
                      Фильтры
                    </label>
                    <div className="flex gap-1">
                      <input
                        checked={form.grayscaleFilter ?? ""}
                        type="checkbox"
                        onChange={(e) =>
                          mainUpdateForm("grayscaleFilter", e.target.checked)
                        }
                      />
                      Чёрно-белый фильтр
                      <span className="tooltip">(включая арт карты)</span>
                    </div>
                  </div>
                  <CardColorInput form={form} setForm={setForm} />
                </div>
              </div>
            </div>
          </form>

          <div className="flex flex-row w-full gap-2">
            <DownloadButton
              idToSave={IMAGE_CROP_SETTINGS.CARD}
              name={form.masterName}
            />
            <ExportImportFeature form={form} setForm={setForm} exportOnly />
          </div>
        </div>

        <div className="xl:w-1/2">
          <Card form={form} isPreview={true} cardType={form.cardToMake} />
        </div>
        <Card form={form} isPreview={false} cardType={form.cardToMake} />
      </div>
    </div>
  );
};
