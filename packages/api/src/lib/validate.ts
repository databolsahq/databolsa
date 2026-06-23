import type { ValidationTargets } from "hono";
import { validator } from "hono-openapi/zod";
import type { ZodSchema } from "zod";
import { BadRequestError } from "../middleware/errors";

// hono-openapi's zod validator does two jobs at once: it validates the request AND
// registers the schema into the generated OpenAPI spec (params/query/body). We keep the
// same RFC 9457 failure hook so invalid input still emits application/problem+json
// instead of the validator's default plain 400 JSON. Drop-in for the old zValidator.
export function validate<Target extends keyof ValidationTargets, Schema extends ZodSchema>(
  target: Target,
  schema: Schema,
) {
  return validator(target, schema, (result) => {
    if (!result.success) {
      const detail = result.error.issues
        .map((i) => `${i.path.join(".") || "campo"}: ${i.message}`)
        .join("; ");
      throw new BadRequestError(detail);
    }
  });
}
