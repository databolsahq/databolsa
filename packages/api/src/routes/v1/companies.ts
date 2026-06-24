import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { company, document, paginated } from "@databolsa/contract";
import { companyService } from "../../services/company.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate } from "../../lib/validators";

const companyListResponse = paginated(company);
const documentsResponse = paginated(document);

const listQuery = paginationQuery.extend({
  sector: z.string().optional().describe("Setor (match exato, case-sensitive). Valor desconhecido → página vazia."),
  segment: z
    .string()
    .optional()
    .describe("Segmento de listagem B3 (substring, case-insensitive), ex.: 'Novo Mercado'."),
  search: z.string().optional().describe("Busca por nome ou ticker da companhia."),
});

const cvmCodeParam = z.object({
  cvm_code: z.coerce
    .number()
    .int()
    .positive()
    .describe("Código CVM NUMÉRICO da companhia (não o ticker). Descubra via /search ou listCompanies."),
});

const documentsQuery = paginationQuery
  .extend({
    category: z
      .string()
      .optional()
      .describe(
        "Categoria do documento no IPE/CVM, ex.: 'Fato Relevante', 'Comunicado ao Mercado', " +
          "'Aviso aos Acionistas', 'Assembleia', 'Dados Econômico-Financeiros'.",
      ),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const companies = new Hono()
  .get(
    "/",
    describeRoute({
      tags: ["Companies"],
      operationId: "listCompanies",
      summary: "Lista companhias abertas (cadastro CVM)",
      responses: ok(companyListResponse, "Página de companhias"),
    }),
    validate("query", listQuery),
    async (c) => c.json(await companyService.list(c.req.valid("query"))),
  )
  .get(
    "/:cvm_code",
    describeRoute({
      tags: ["Companies"],
      operationId: "getCompany",
      summary: "Companhia por código CVM",
      responses: ok(company, "Companhia"),
    }),
    validate("param", cvmCodeParam),
    async (c) => c.json(await companyService.getByCvmCode(c.req.valid("param").cvm_code)),
  )
  .get(
    "/:cvm_code/documents",
    describeRoute({
      tags: ["Companies"],
      operationId: "listCompanyDocuments",
      summary: "Documentos e comunicados (IPE/CVM)",
      description:
        "Fatos relevantes, comunicados e documentos protocolados na CVM (IPE) da companhia (por código CVM). " +
        "Filtre por `category` e por período (`from`/`to`); paginação por cursor.",
      responses: ok(documentsResponse, "Página de documentos"),
    }),
    validate("param", cvmCodeParam),
    validate("query", documentsQuery),
    async (c) =>
      c.json(await companyService.documents(c.req.valid("param").cvm_code, c.req.valid("query"))),
  );
