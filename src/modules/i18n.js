import { challengeMessages as ruChallenges, messages as ru } from "../i18n/locales/ru.js";
import { challengeMessages as enChallenges, messages as en } from "../i18n/locales/en.js";
import { challengeMessages as plChallenges, messages as pl } from "../i18n/locales/pl.js";
import { challengeMessages as esChallenges, messages as es } from "../i18n/locales/es.js";
import { challengeMessages as trChallenges, messages as tr } from "../i18n/locales/tr.js";
import { challengeMessages as ptChallenges, messages as pt } from "../i18n/locales/pt.js";
import { challengeMessages as idChallenges, messages as id } from "../i18n/locales/id.js";
import { challengeMessages as itChallenges, messages as it } from "../i18n/locales/it.js";

export const TRANSLATIONS = { ru, en, pl, es, tr, pt, id, it };

export const CHALLENGE_UI = {
  ru: ruChallenges,
  en: enChallenges,
  pl: plChallenges,
  es: esChallenges,
  tr: trChallenges,
  pt: ptChallenges,
  id: idChallenges,
  it: itChallenges
};

export function challengeUi(language, key) {
  return CHALLENGE_UI[language]?.[key] || CHALLENGE_UI.en[key] || key;
}
