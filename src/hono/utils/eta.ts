import { resolve } from "@std/path/resolve";
import { Eta } from "eta";

export function createEta(directory: string = "./views") {
  return new Eta({
    views: resolve(directory),
    cache: true,
  });
}

export const eta = createEta();