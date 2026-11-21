import React from "react";
import "../styles/image-cropper.css";

const RecropImagebutton = ({ croppedImage, recropImage }: { croppedImage: string; recropImage: () => void }) => {
  return (
    <div>
      <button className="recrop-button bg-blue-500 hover:bg-blue-400" onClick={recropImage}>
        Обрезать заново
      <img
        src={croppedImage}
        alt="Обрезанное изображение"
        className="w-8 object-cover rounded-md"
      />
      </button>
    </div>
  );
};

export default RecropImagebutton;
