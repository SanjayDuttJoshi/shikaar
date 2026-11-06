import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";

/** Lets node scripts import game modules from src/ (TypeScript + the "@/" alias). */
export const SRC = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
