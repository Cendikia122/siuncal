import crypto from "crypto";

const getPassengerLocationScope = (filters = {}) => {
  if (filters.route_id) return { scope_type: "ROUTE", route_id: filters.route_id, bbox_provided: Boolean(filters.bbox) };
  if (filters.bbox) return { scope_type: "BBOX", route_id: null, bbox_provided: true };
  return { scope_type: "GLOBAL", route_id: null, bbox_provided: false };
};

const passengerPseudonym = (userId) => `passenger-${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 10)}`;

export const createPassengerLocationAccess = ({
  requireScopedOperatorAccess,
  maskOperatorIdentity
}) => {
  const getPassengerLocationAccessPolicy = (principal, filters = {}) => {
    const roles = principal?.roles || [];
    const isAnalisa = roles.includes("ANALISA");
    const scope = getPassengerLocationScope(filters);
    const scopeRequired = roles.includes("OPERATOR") && requireScopedOperatorAccess;
    return {
      ...scope,
      allowed: isAnalisa || !scopeRequired || scope.scope_type !== "GLOBAL",
      identity_access: isAnalisa || !maskOperatorIdentity ? "FULL" : "MASKED",
      scope_required: scopeRequired
    };
  };

  const serializePassengerForPrincipal = (passenger, principal) => {
    const policy = getPassengerLocationAccessPolicy(principal);
    if (policy.identity_access === "FULL") return passenger;
    const pseudonym = passengerPseudonym(passenger.user_id);
    return {
      ...passenger,
      user_id: pseudonym,
      session_id: null,
      name: `Passenger ${pseudonym.slice(-4).toUpperCase()}`,
      email: null,
      phone: null,
      profile_photo_url: null
    };
  };

  return {
    getPassengerLocationAccessPolicy,
    serializePassengerForPrincipal
  };
};
