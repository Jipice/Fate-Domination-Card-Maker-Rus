import { FaDownload } from "react-icons/fa";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";
import { snapdom } from "@zumer/snapdom";
import React, { useState } from "react";

type downloadProps = {
  idToSave: IMAGE_CROP_SETTINGS;
  name: string | null;
};

export const DownloadButton = ({ idToSave, name }: downloadProps) => {
  const [downloading, setDownloading] = useState<boolean>(false);

  async function downloadPic() {
    setDownloading(true);
    const pic = document.getElementById(idToSave + "-to-save");

    if (!pic) return;

    const result = await snapdom(pic);

    await result.download({
      format: "png",
      filename: `${name || "master-card"}.png`,
    });
    setDownloading(false);
  }

  return (
    <button
      onClick={() => downloadPic()}
      className={`import-export-button ${downloading ? "bg-gray-500" : "bg-blue-500 hover:bg-blue-400"}`}
      disabled={downloading}
    >
      <FaDownload />
      {downloading ? "Загрузка..." : "Скачать"}
    </button>
  );
};
