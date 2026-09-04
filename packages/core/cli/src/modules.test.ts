import { describe, expect, test } from "bun:test";
import { topUsage } from "./commands";
import { splitModule } from "./run";

describe("CLI agregadora: módulos", () => {
  const modules = { wallet: { specPath: "/openapi-wallet.json", blurb: "" } };
  test("primeiro token igual a um módulo delega e some do argv", () => {
    expect(splitModule(["wallet", "listPortfolios", "--json"], modules)).toEqual({ module: "wallet", argv: ["listPortfolios", "--json"] });
  });
  test("operação do core, flag ou sem módulos: argv intacto", () => {
    expect(splitModule(["listObjects", "PETR4"], modules)).toEqual({ argv: ["listObjects", "PETR4"] });
    expect(splitModule(["--list"], modules)).toEqual({ argv: ["--list"] });
    expect(splitModule(["wallet"], undefined)).toEqual({ argv: ["wallet"] });
  });

  test("ajuda chama o módulo de atalho e não confunde contrato com instalação", () => {
    const help = topUsage({ wallet: "acesso depende da instalação no workspace" });
    expect(help).toContain("Atalhos de contrato (não indicam instalação no workspace)");
    expect(help).toContain("databolsa wallet --list");
    expect(help).not.toContain("Módulos (extensões");
  });
});
