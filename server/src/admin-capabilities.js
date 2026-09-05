import { HttpError } from './utils.js';

export const ADMIN_CAPABILITIES = Object.freeze([
  'ai.providers.view',
  'ai.providers.manage',
  'ai.credentials.rotate',
  'ai.models.manage',
  'ai.routing.manage',
  'ai.health.view',
  'users.view',
  'users.pii.reveal',
  'users.content.reveal',
  'users.restrict',
  'appeals.review',
  'billing.view',
  'billing.manage',
  'credits.grant',
  'pricing.manage',
  'cms.edit',
  'cms.publish',
  'audit.view',
  'retention.execute',
  'incidents.manage',
  'roles.manage',
]);

const AI_CAPABILITIES = ADMIN_CAPABILITIES.slice(0, 6);

const ROLE_CAPABILITIES = Object.freeze({
  owner: ADMIN_CAPABILITIES,
  admin: Object.freeze(ADMIN_CAPABILITIES.filter((capability) => ![
    'users.pii.reveal',
    'users.content.reveal',
  ].includes(capability))),
  ai_admin: Object.freeze(AI_CAPABILITIES),
  support_admin: Object.freeze([
    'users.view',
    'users.restrict',
    'appeals.review',
    'incidents.manage',
  ]),
  billing_admin: Object.freeze([
    'billing.view',
    'billing.manage',
    'credits.grant',
    'pricing.manage',
  ]),
  content_admin: Object.freeze([
    'cms.edit',
    'cms.publish',
  ]),
  privacy_admin: Object.freeze([
    'users.view',
    'users.pii.reveal',
    'audit.view',
    'retention.execute',
  ]),
  content_forensics_admin: Object.freeze([
    'users.view',
    'users.content.reveal',
    'audit.view',
    'incidents.manage',
  ]),
  security_admin: Object.freeze([
    'users.view',
    'users.restrict',
    'audit.view',
    'incidents.manage',
    'roles.manage',
  ]),
  auditor: Object.freeze([
    'ai.health.view',
    'billing.view',
    'audit.view',
  ]),
});

const KNOWN_CAPABILITIES = new Set(ADMIN_CAPABILITIES);

export function capabilitiesForUser(user) {
  const capabilities = ROLE_CAPABILITIES[String(user?.role || '').toLowerCase()] || [];
  return [...capabilities];
}

export function hasCapability(user, capability) {
  return capabilitiesForUser(user).includes(capability);
}

export function requireCapability(capability) {
  if (!KNOWN_CAPABILITIES.has(capability)) {
    throw new TypeError(`Unknown admin capability: ${capability}`);
  }
  return (req, _res, next) => {
    if (!hasCapability(req.user, capability)) {
      return next(new HttpError(403, 'Akses tidak tersedia untuk tugas admin ini.', 'ADMIN_CAPABILITY_REQUIRED'));
    }
    return next();
  };
}

export function isPrivilegedUser(user) {
  return capabilitiesForUser(user).length > 0;
}

export { ROLE_CAPABILITIES };
