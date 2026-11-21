import React, { useState } from "react";

const ResetColorsButton = ({
  hasNoNewColors,
  resetColors,
}: {
  hasNoNewColors: boolean;
  resetColors: () => void;
}) => {
  const [confirmResetColors, setConfirmResetColors] = useState(false);

  function confirmResetPresetColors() {
    if (confirmResetColors) {
      resetColors();
      setConfirmResetColors(false);
    } else {
      setConfirmResetColors(true);
    }
  }
  return (
    <>
      {!confirmResetColors && (
        <button
          className={`p-1 w-full bg-gray-300 rounded flex flex-grow justify-center ${hasNoNewColors ? "opacity-50" : "cursor-pointer"}`}
          onClick={() => confirmResetPresetColors()}
          disabled={hasNoNewColors}
        >
          Сбросить цвета
        </button>
      )}
      {confirmResetColors && (
        <div>
          <span className="italic text-xs flex flex-col justify-center text-center">
            <span>Вы уверены, что хотите</span>
            <span>сбросить сохранённые цвета?</span>
          </span>
          <div className="flex gap-1">
            <button
              className={`p-1 bg-red-400 rounded flex flex-grow justify-center ${hasNoNewColors ? "opacity-50" : "cursor-pointer"}`}
              onClick={() => confirmResetPresetColors()}
              disabled={hasNoNewColors}
            >
              Да, сбросить!
            </button>
            <button
              className={`p-1 bg-blue-400 rounded flex flex-grow justify-center ${hasNoNewColors ? "opacity-50" : "cursor-pointer"}`}
              onClick={() => setConfirmResetColors(false)}
              disabled={hasNoNewColors}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ResetColorsButton;
