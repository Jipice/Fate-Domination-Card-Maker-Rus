"use client";

import { SaveToLibraryButton, useLibraryLoader } from "@/src/features/library/library";
import { useState } from "react";
import { DownloadButton } from "@/src/components/buttons/DownloadButton";
import defaultCommandSeal from "./images/default-command-seal.png";
import SimpleMasterForm from "@/src/features/master-assets/components/SimpleMasterForm";
import CommandSeal from "./components/CommandSeal";
import { IMAGE_CROP_SETTINGS } from "@/src/constants/cropConstants";
import CustomCommandSealNameOptions from "./components/CustomCommandSealNameOptions";
import { NAME_FIELD_SIZES } from "@/src/constants/formConstants";

const emptyState: { pic: string; name: string, nameFieldSize: NAME_FIELD_SIZES } = {
  pic: defaultCommandSeal.src,
  name: "Командное Заклинание",
  nameFieldSize: NAME_FIELD_SIZES.short, 
};

const CommandSealCreation = () => {
  const [form, setForm] = useState<{ pic: string; name: string, nameFieldSize: NAME_FIELD_SIZES }>(emptyState);
  const libraryId = useLibraryLoader<typeof emptyState>("command-seal", setForm);
  return (
    <div>
      <SimpleMasterForm
        emptyState={emptyState}
        setForm={setForm}
        imageCropSettings={IMAGE_CROP_SETTINGS.COMMAND_SEAL}
      />

      <CustomCommandSealNameOptions setForm={setForm} defaultName={form.name} nameFieldSize={form.nameFieldSize} />

      <CommandSeal form={form} isPreview={true} />
      <CommandSeal form={form} isPreview={false} />
      
      <div className="flex flex-row w-full gap-2">
        <SaveToLibraryButton
  captureId={IMAGE_CROP_SETTINGS.COMMAND_SEAL + "-to-save"}
  page="command-seal" name={form.name} getForm={() => form} libraryId={libraryId} />
        <DownloadButton idToSave={IMAGE_CROP_SETTINGS.COMMAND_SEAL} name={IMAGE_CROP_SETTINGS.COMMAND_SEAL} />
      </div>
    </div>
  );
};

export default CommandSealCreation;
