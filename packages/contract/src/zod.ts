// Single import site for Zod across the contract: loading `zod-openapi/extend` first
// augments every Zod schema with `.openapi({ ref, ... })`, so any module that pulls `z`
// from here can attach OpenAPI metadata without repeating the side-effect import.
import "zod-openapi/extend";

export { z } from "zod";
