import { Figtree } from "next/font/google";

/** Tipografía de la marca. Compartida por el layout raíz y `global-error`, que lo reemplaza cuando falla. */
export const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree", display: "swap" });
