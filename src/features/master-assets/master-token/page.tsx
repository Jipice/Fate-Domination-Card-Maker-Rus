"use client";

import { SaveToLibraryButton, useLibraryLoader } from "@/src/features/library/library";
import { useState } from "react";
import { DownloadButton } from "@/src/components/buttons/DownloadButton";
import shirouToken from "./images/shirou-token.png";
import SimpleMasterForm from "@/src/features/master-assets/components/SimpleMasterForm";
import { MasterAsset } from "../components/MasterAsset";
import { MasterPicAndColorForm } from "../types/formTypes";
import ColorInputWithGradient from "../components/ColorInputWithGradient";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";

const emptyState: MasterPicAndColorForm = {
  pic: shirouToken.src,
  borderColor: "#000000",
  colorMode: "solid",
  gradientColors: ["#ffffff", "#000000"],
};
const assetType = IMAGE_CROP_SETTINGS.TOKEN;

const MasterTokenCreation = () => {
  const [form, setForm] = useState<MasterPicAndColorForm>(emptyState);
  const libraryId = useLibraryLoader<MasterPicAndColorForm>("master-token", setForm);
  return (
    <div>
      <SimpleMasterForm
        emptyState={emptyState}
        setForm={setForm}
        imageCropSettings={assetType}
      />
      <ColorInputWithGradient form={form} setForm={setForm} />
      <MasterAsset form={form} isPreview={true} assetType={assetType} />
      <MasterAsset form={form} isPreview={false} assetType={assetType} />
      <div className="flex flex-row w-full gap-2">
        <SaveToLibraryButton
  captureId={assetType + "-to-save"}
  page="master-token" name="Жетон мастера" getForm={() => form} libraryId={libraryId} />
        <DownloadButton idToSave={assetType} name={"master-token"} />
      </div>
    </div>
  );
};

export default MasterTokenCreation;
