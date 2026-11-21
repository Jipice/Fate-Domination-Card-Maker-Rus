"use client";

import { useState } from "react";
import { DownloadButton } from "@/src/components/buttons/DownloadButton";
import { ServantCardForm } from "./types/formTypes";
import { SERVANT_TYPES } from "@/src/constants/servantConstants";
import { PageName } from "@/src/components/header/PageName";
import { ClearFormButton } from "@/src/components/header/ClearFormButton";
import ImageCropper from "../../components/image-cropper/ImageCropper";
import { ServantSummon } from "./components/ServantSummonCard";
import TraitsAndDrawbacks from "./components/TraitsAndDrawbacks";
import { BASIC_CARDS } from "@/src/constants/cardConstants";
import { capitalizeString } from "@/src/utils/TextUtils";
import { BasicCardTypes } from "@/src/types/cardTypes";
import ColorInput from "../master-assets/components/ColorInput";
import { Color } from "@/src/types/colorTypes";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";

const defaultState: ServantCardForm = {
  class: SERVANT_TYPES.STANDARD[0],
  name: "Крутое имя слуги",
  servantNameColor: "#ffffff" as Color,
  primaryTrait: BASIC_CARDS[1],
  traits: ["Получение очков победы", "Контроль"],
  drawbacks: ["Зависит от подготовки", "Зависит от благородного фантазма"],
  pic: "",
};

const emptyState: ServantCardForm = {
  class: SERVANT_TYPES.STANDARD[0],
  name: "",
  servantNameColor: "#ffffff" as Color,
  primaryTrait: BASIC_CARDS[0],
  traits: ["", ""],
  drawbacks: ["", ""],
  pic: "",
};

const ServantCard = () => {
  const [form, setForm] = useState<ServantCardForm>(defaultState);
  return (
    <div>
      <div className="flex flex-row items-center gap-2">
        <PageName />
        <ClearFormButton setForm={setForm} emptyState={emptyState} />
      </div>
      <div className="lg:flex flex-row">
        <div className="w-1/2">
          <div className="input-block">
            <label htmlFor="masterName" className="field-header">
              Card Name
            </label>
            <div className="flex flex-row align-center gap-3">
              <input
                type="text"
                id="masterName"
                name="masterName"
                value={form.name ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="input-block">
            <div>
              <ColorInput
                label={"Цвет имени"}
                value={form.servantNameColor}
                handleValue={(color: string) =>
                  setForm((prev) => ({
                    ...prev,
                    servantNameColor: color as Color,
                  }))
                }
              />
            </div>
          </div>
          <div className="input-block flex flex-col">
            <label className="field-header" htmlFor="servantClass">
              Servant Class
            </label>
            <select
              defaultValue={form.class}
              id="servantClass"
              name="servantClass"
              onChange={(e) =>
                setForm((prev: ServantCardForm) => ({
                  ...prev,
                  class: e.target.value,
                }))
              }
            >
              <option value="">Нет</option>
              <option value="" disabled>
                &#10022; ОСНОВНЫЕ
              </option>
              {SERVANT_TYPES.STANDARD.map((servantType, i) => (
                <option key={i} value={servantType}>
                  {({Saber:"Сэйбер",Lancer:"Лансер",Archer:"Арчер",Rider:"Райдер",Caster:"Кастер",Assassin:"Ассасин",Berserker:"Берсерк", "Alter Ego":"Альтер-эго",Avenger:"Мститель",Beast:"Зверь", "Beast (Black)":"Зверь (чёрный)",Foreigner:"Форейнер", "Moon Cancer":"Лунный рак",Pretender:"Претендент",Ruler:"Правитель",Shielder:"Защитник"} as Record<string,string>)[servantType]}
                </option>
              ))}
              <option value="" disabled>
                &#10022; EXTRA
              </option>
              {SERVANT_TYPES.EXTRA.map((servantType, i) => (
                <option key={i} value={servantType}>
                  {({Saber:"Сэйбер",Lancer:"Лансер",Archer:"Арчер",Rider:"Райдер",Caster:"Кастер",Assassin:"Ассасин",Berserker:"Берсерк", "Alter Ego":"Альтер-эго",Avenger:"Мститель",Beast:"Зверь", "Beast (Black)":"Зверь (чёрный)",Foreigner:"Форейнер", "Moon Cancer":"Лунный рак",Pretender:"Претендент",Ruler:"Правитель",Shielder:"Защитник"} as Record<string,string>)[servantType]}
                </option>
              ))}
            </select>
          </div>
          <div className="input-block">
            <h2 className="field-header">Особенности</h2>
            <TraitsAndDrawbacks
              traits={form.traits}
              drawbacks={form.drawbacks}
              isTraits={true}
              setForm={setForm}
            />
          </div>
          <div className="input-block">
            <h2 className="field-header">Недостатки</h2>
            <TraitsAndDrawbacks
              traits={form.traits}
              drawbacks={form.drawbacks}
              isTraits={false}
              setForm={setForm}
            />
          </div>

          <div>
            <div className="input-block w-full">
              <h2 className="field-header">Изображение карты</h2>
              <ImageCropper
                setCroppedImageForForm={(croppedPic) =>
                  setForm((prev) => ({
                    ...prev,
                    pic: croppedPic,
                  }))
                }
                cropSettings={IMAGE_CROP_SETTINGS.SERVANT_SUMMON}
              />
            </div>
          </div>

          <div className="input-block flex flex-col">
            <label className="field-header" htmlFor="primaryTrait">
              Primary Trait
            </label>
            <span className="italic text-sm">
              (Tip: This affects the horizontal line color)
            </span>
            <select
              value={form.primaryTrait}
              id="primaryTrait"
              name="primaryTrait"
              onChange={(e) =>
                setForm((prev: ServantCardForm) => ({
                  ...prev,
                  primaryTrait: e.target.value,
                }))
              }
            >
              {BASIC_CARDS.map((card: BasicCardTypes, i) => (
                <option value={card} key={i}>
                  {capitalizeString(card)}
                </option>
              ))}
            </select>
          </div>
          <span className="flex">
          <DownloadButton
            idToSave={IMAGE_CROP_SETTINGS.SERVANT_SUMMON}
            name={form.name}
          />
          </span>
        </div>
        <div className="w-1/2">
          <ServantSummon form={form} isPreview={true} />
          <ServantSummon form={form} isPreview={false} />
        </div>
      </div>
    </div>
  );
};

export default ServantCard;
