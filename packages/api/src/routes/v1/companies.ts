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
  sector: z.string().optional(),
  segment: z.string().optional(),
  search: z.string().optional(),
});

const cvmCodeParam = z.object({ cvm_code: z.coerce.number().int().positive() });

const documentsQuery = paginationQuery
  .extend({
    category: z.string().optional(),
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
      responses: ok(documentsResponse, "Página de documentos"),
    }),
    validate("param", cvmCodeParam),
    validate("query", documentsQuery),
    async (c) =>
      c.json(await companyService.documents(c.req.valid("param").cvm_code, c.req.valid("query"))),
  );
