import type { Translator } from "./messages";

const speciesKeys: Record<string, Parameters<Translator>[0]> = {
  canine: "patients.species.canine", feline: "patients.species.feline", avian: "patients.species.avian", rabbit: "patients.species.rabbit", reptile: "patients.species.reptile", equine: "patients.species.equine", other: "patients.species.other",
};
const sexKeys: Record<string, Parameters<Translator>[0]> = {
  male: "patients.sex.male", female: "patients.sex.female", male_neutered: "patients.sex.male_neutered", female_spayed: "patients.sex.female_spayed",
};
const patientStatusKeys: Record<string, Parameters<Translator>[0]> = {
  active: "patients.active", inactive: "patients.inactive", deceased: "patients.deceased",
};

export function speciesLabel(t: Translator, value: string | null | undefined) { return value ? t(speciesKeys[value] ?? "patients.species.other") : t("patients.unknown"); }
export function sexLabel(t: Translator, value: string | null | undefined) { return value ? t(sexKeys[value] ?? "patients.unknown") : t("patients.unknown"); }
export function patientStatusLabel(t: Translator, value: string | null | undefined) { return value ? t(patientStatusKeys[value] ?? "patients.unknown") : t("patients.active"); }
