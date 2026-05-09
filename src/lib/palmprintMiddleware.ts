import { createPalmprintNext } from "../../packages/server/src/next";
import { palmprint } from "./palmprintInstance";

export type {
  PalmprintHandler,
  RequirePalmprintOptions,
} from "../../packages/server/src/next";

export const { requirePalmprint, tryVerifyRequest } =
  createPalmprintNext(palmprint);
