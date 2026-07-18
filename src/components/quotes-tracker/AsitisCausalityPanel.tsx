"use client";

import React from "react";
import { Profile } from "@/types";
import { CausalityTemplatePanel, CausalityTemplateConfig, TitleItem } from "./CausalityTemplatePanel";

export interface AsitisCausalityPanelProps {
  profile: Profile | null;
  isOnline: boolean;
}

const DEFAULT_MAIN_TITLES: TitleItem[] = [
  { id: "main-ph", text: "PH –" },
  { id: "main-occ", text: "Occupation –" },
  { id: "main-ind", text: "Industry –" },
  { id: "main-lic", text: "1. Licence obtained date :" },
  { id: "main-rel", text: "2. Relationship status :" },
  { id: "main-acc", text: "3. Access to other car :" },
  { id: "main-mil", text: "4. Mileage:" },
  { id: "main-res", text: "5. UK Residency:" },
  { id: "main-val", text: "6. Vehicle Value:" },
  { id: "main-use", text: "7. Use of Vehicle :" },
  { id: "main-pur", text: "8. Vehicle purchase date:" },
  { id: "main-own", text: "9. Homeowner:" },
  { id: "main-day", text: "10. Day:" },
  { id: "main-ngt", text: "11. Night:" },
  { id: "main-raw", text: "12. Raw quote reference:" },
  { id: "main-cnt", text: "13. How many cars in the household:" },
  { id: "main-chd", text: "14. Children:" },
  { id: "main-ncd", text: "15. NCD:" },
  { id: "main-row", text: "16. Registered Owner :" },
  { id: "main-rkp", text: "17. Registered Keeper:" }
];

const getDriverDefaultTitles = (id: number): TitleItem[] => {
  const paddedId = String(id).padStart(2, "0");
  return [
    { id: `drv-${id}-rel`, text: `PH Relationship with the Add Driver ${paddedId}:` },
    { id: `drv-${id}-name`, text: `Add ${paddedId}: –` },
    { id: `drv-${id}-occ`, text: "Occupation –" },
    { id: `drv-${id}-ind`, text: "Industry –" },
    { id: `drv-${id}-lic`, text: "Licence obtained date :" },
    { id: `drv-${id}-rel_status`, text: "Relationship status :" },
    { id: `drv-${id}-acc`, text: "Access to other car :" },
    { id: `drv-${id}-res`, text: "UK Residency:" }
  ];
};

const ASITIS_CONFIG: CausalityTemplateConfig = {
  panelTitle: "Asitis Causality Format",
  shortName: "Asitis",
  templateDbId: "__asitis_causality_template__",
  templateDbName: "Asitis Causality Template",
  draftStorageKey: "quotes_asitis_causality_template_draft",
  defaultMainTitles: DEFAULT_MAIN_TITLES,
  getDriverDefaultTitles,
  // No unnumberedIds: Asitis titles carry their numbers in the text itself
};

export const AsitisCausalityPanel: React.FC<AsitisCausalityPanelProps> = ({ profile, isOnline }) => (
  <CausalityTemplatePanel profile={profile} isOnline={isOnline} config={ASITIS_CONFIG} />
);
