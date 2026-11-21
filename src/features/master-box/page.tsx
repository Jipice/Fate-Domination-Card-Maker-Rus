"use client";

import { SaveToLibraryButton, useLibraryLoader } from "@/src/features/library/library";
import { useState } from "react";
import { DownloadButton } from "@/src/components/buttons/DownloadButton";
import shirouBox from "./images/shirou-box.png";
import SimpleMasterForm from "@/src/features/master-assets/components/SimpleMasterForm";
import { BoxPicAndColorForm } from "../master-assets/types/formTypes";
import { MasterBox } from "./components/MasterBox";
import { MasterBoxPreview } from "./components/MasterBoxPreview";
import ColorInput from "../master-assets/components/ColorInput";
import { Color } from "@/src/types/colorTypes";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";

const emptyState: BoxPicAndColorForm = {
  pic: shirouBox.src,
  borderColor: "#3a638a",
};

const MasterBoxCreation = () => {
  const [form, setForm] = useState<BoxPicAndColorForm>(emptyState);
  const libraryId = useLibraryLoader<BoxPicAndColorForm>("master-box", setForm);
  return (
    <div>
      <SimpleMasterForm
        emptyState={emptyState}
        setForm={setForm}
        imageCropSettings={IMAGE_CROP_SETTINGS.MASTER_BOX}
      />
      <ColorInput
        label={"Цвет боковых сторон коробки"}
        value={form.borderColor}
        handleValue={(color: string) =>
          setForm((prev) => ({
            ...prev,
            borderColor: color as Color,
          }))
        }
      />
      <MasterBox form={form} isPreview={false} />
      <MasterBoxPreview form={form} />
      <div className="flex flex-row w-full gap-2">
        <SaveToLibraryButton
  captureId={IMAGE_CROP_SETTINGS.MASTER_BOX + "-to-save"}
  page="master-box" name="Коробка мастера" getForm={() => form} libraryId={libraryId} />
        <DownloadButton
          idToSave={IMAGE_CROP_SETTINGS.MASTER_BOX}
          name={IMAGE_CROP_SETTINGS.MASTER_BOX}
        />
      </div>
    </div>
  );
};

export default MasterBoxCreation;
