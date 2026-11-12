// Genera ABIs tipados (`as const`) a partir de los artefactos de Foundry.
// Uso: pnpm --filter @escrow/shared generate:abi   (requiere `forge build` previo en packages/contracts)
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contractsOut = resolve(here, "../../contracts/out");
const abiDir = resolve(here, "../src/abi");

const targets = [
  { artifact: "MilestoneEscrow.sol/MilestoneEscrow.json", file: "milestone-escrow.ts", name: "milestoneEscrowAbi" },
];

for (const { artifact, file, name } of targets) {
  const { abi } = JSON.parse(await readFile(resolve(contractsOut, artifact), "utf8"));
  const source = [
    "// Archivo generado por scripts/generate-abi.mjs a partir de packages/contracts. No editar a mano.",
    `export const ${name} = ${JSON.stringify(abi, null, 2)} as const;`,
    "",
  ].join("\n");
  await writeFile(resolve(abiDir, file), source);
  console.log(`✔ ${file} (${abi.length} entradas)`);
}
