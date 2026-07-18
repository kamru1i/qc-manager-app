"use client";

import React from "react";
import { Profile } from "@/types";
import { CausalityTemplatePanel, CausalityTemplateConfig, TitleItem } from "./CausalityTemplatePanel";

export interface EUICausalityPanelProps {
  profile: Profile | null;
  isOnline: boolean;
}

/**
 * IDs that are NOT counted in the sequential numbered list.
 * eui-ph, eui-occupation, eui-industry → top un-numbered header fields
 * eui-parking-day, eui-parking-night   → sub-items under "Vehicle Parking"
 */
const UNNUMBERED_IDS = new Set([
  "eui-ph",
  "eui-occupation",
  "eui-industry",
  "eui-parking-day",
  "eui-parking-night"
]);

/**
 * Exact EUI Causality default format as specified:
 *
 * PH –
 * Occupation –
 * Industry –
 * 1.  Homeowner yes/no -
 * 2.  Access to other cars -
 * 3.  How many cars in the household -
 * 4.  Marital Status -
 * 5.  UK resident date –
 * 6.  License obtained date -
 * 7.  Quote Email --
 * 8.  Phone number -
 * 9.  Raw quote reference -
 * 10. NCD -
 * 11. Registered keeper and Owner -
 * 12. Vehicle purchase date -
 * 13. Usage of vehicle -
 * 14. Annual mileage -
 * 15. Vehicle Price -
 * 16. Vehicle Parking
 *          Day:
 *          Night:
 * 17. Children -
 * 18. Type of Cover -
 */
const DEFAULT_MAIN_TITLES: TitleItem[] = [
  { id: "eui-ph",           text: "PH –" },
  { id: "eui-occupation",   text: "Occupation –" },
  { id: "eui-industry",     text: "Industry –" },
  { id: "eui-homeowner",    text: "Homeowner yes/no -" },
  { id: "eui-access",       text: "Access to other cars -" },
  { id: "eui-household",    text: "How many cars in the household -" },
  { id: "eui-marital",      text: "Marital Status -" },
  { id: "eui-uk-resident",  text: "UK resident date –" },
  { id: "eui-license",      text: "License obtained date -" },
  { id: "eui-email",        text: "Quote Email --" },
  { id: "eui-phone",        text: "Phone number -" },
  { id: "eui-raw-quote",    text: "Raw quote reference -" },
  { id: "eui-ncd",          text: "NCD -" },
  { id: "eui-keeper-owner", text: "Registered keeper and Owner -" },
  { id: "eui-purchase-date",text: "Vehicle purchase date -" },
  { id: "eui-usage",        text: "Usage of vehicle -" },
  { id: "eui-mileage",      text: "Annual mileage -" },
  { id: "eui-price",        text: "Vehicle Price -" },
  { id: "eui-parking",      text: "Vehicle Parking" },
  { id: "eui-parking-day",  text: "         Day:" },
  { id: "eui-parking-night",text: "         Night:" },
  { id: "eui-children",     text: "Children -" },
  { id: "eui-cover-type",   text: "Type of Cover -" }
];

/**
 * Default driver block format:
 *
 * PH Relationship with the Add Driver 01 -
 * Add. Driver 01: –
 * Occupation –
 * Industry –
 * Access to other cars:
 * Marital Status:
 * UK resident date:
 * License obtained date:
 */
const getDriverDefaultTitles = (id: number): TitleItem[] => {
  const p = String(id).padStart(2, "0");
  return [
    { id: `drv-${id}-rel`,        text: `PH Relationship with the Add Driver ${p} -` },
    { id: `drv-${id}-name`,       text: `Add. Driver ${p}: –` },
    { id: `drv-${id}-occ`,        text: "Occupation –" },
    { id: `drv-${id}-ind`,        text: "Industry –" },
    { id: `drv-${id}-access`,     text: "Access to other cars:" },
    { id: `drv-${id}-marital`,    text: "Marital Status:" },
    { id: `drv-${id}-uk-resident`,text: "UK resident date:" },
    { id: `drv-${id}-license`,    text: "License obtained date:" }
  ];
};

const EUI_CONFIG: CausalityTemplateConfig = {
  panelTitle: "EUI Causality Format",
  shortName: "EUI",
  templateDbId: "__eui_causality_template_v2__",
  templateDbName: "EUI Causality Template",
  draftStorageKey: "quotes_eui_causality_template_draft_v2",
  // Always clear the old v1 key so stale data never leaks through
  legacyDraftKeysToClear: ["quotes_eui_causality_template_draft"],
  defaultMainTitles: DEFAULT_MAIN_TITLES,
  getDriverDefaultTitles,
  unnumberedIds: UNNUMBERED_IDS,
};

export const EUICausalityPanel: React.FC<EUICausalityPanelProps> = ({ profile, isOnline }) => (
  <CausalityTemplatePanel profile={profile} isOnline={isOnline} config={EUI_CONFIG} />
);
