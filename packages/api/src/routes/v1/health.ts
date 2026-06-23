import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { health as healthSchema } from "@databolsa/contract";
import { healthService } from "../../services/health.service";
import { ok } from "../../lib/openapi";

export const health = new Hono().get(
  "/health",
  describeRoute({
    tags: ["System"],
    operationId: "getHealth",
    summary: "Status da API e frescor dos dados",
    security: [],
    responses: ok(healthSchema, "Status"),
  }),
  async (c) => c.json(await healthService.status()),
);
