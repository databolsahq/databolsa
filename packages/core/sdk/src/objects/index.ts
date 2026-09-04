export { Objects } from "./facade";
export type { AggregateParams, ListParams, RankParams, ResolveOpts, ResolveOutcome } from "./facade";
export { ObjectHandle } from "./handle";
export type { AspectOpts, FactOf, FunctionOf, FunctionParams, FunctionResult, HistoryOpts, LinksOpts, ObjectProperty, PropertyOf, RelatedOpts, RelationAccessor, RelationAccessors } from "./handle";
export { CompanyHandle, EquitySecurityHandle, FundHandle, InstrumentHandle, isFutureKind } from "./kinds";
export { Account, assetRefOf } from "./account";
export type { AssetLike } from "./account";
export { TIPOS_DE_CODIGO } from "./facade";
export type { AnyObjectHandle, CorporateEventsOpts, FutureObjectHandle, HandleOf, RatingsOpts } from "./kinds";
export { OPERACOES_LIGADAS, parametroTemporal } from "./bindings";
export {
  AmbiguousObjectError,
  AmbiguousPaperError,
  AspectUnavailableError,
  ObjectNotFoundError,
  TemporalCutUnsupportedError,
  UnboundAspectError,
  UnknownFactError,
  SubjectOverrideError,
  TemporalConflictError,
  NotIssuedError,
} from "./errors";
export type { ObjectCandidateRef } from "./errors";
export type { ObjectAspect, ObjectCandidate, ObjectDeclaredFact, ObjectEdge, ObjectFact, ObjectHistorySeries, ObjectMap, ObjectStub, RangeOpts, UnknownKind } from "./types";
