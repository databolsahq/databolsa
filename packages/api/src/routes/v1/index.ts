import { Hono } from "hono";
import { health } from "./health";
import { companies } from "./companies";
import { stocks } from "./stocks";
import { screener } from "./screener";
import { macro } from "./macro";
import { bonds } from "./bonds";
import { indices } from "./indices";
import { series } from "./series";
import { fiis } from "./fiis";
import { bdr } from "./bdr";
import { options } from "./options";
import { crypto } from "./crypto";
import { search } from "./search";
import { ingest } from "./ingest";

// One unbroken `.route()` chain so Hono infers the full type for the RPC client.
export const v1 = new Hono()
  .route("/", health)
  .route("/companies", companies)
  .route("/stocks", stocks)
  .route("/screener", screener)
  .route("/macro", macro)
  .route("/bonds", bonds)
  .route("/indices", indices)
  .route("/series", series)
  .route("/fiis", fiis)
  .route("/bdr", bdr)
  .route("/options", options)
  .route("/crypto", crypto)
  .route("/search", search)
  .route("/ingest", ingest);
