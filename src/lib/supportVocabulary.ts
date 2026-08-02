/**
 * supportVocabulary — the priority and category values shared by the requester's
 * screen, the platform admin's queue and the response-time dashboard.
 *
 * Kept out of either page so the two cannot drift apart: a value offered on one
 * screen but unknown to the other is the kind of mismatch that only shows up as
 * a constraint violation in production. These strings must match the CHECK
 * constraints in 20260620000008 exactly.
 */

export const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#94a3b8' },
  { value: 'normal', label: 'Normal', color: '#60a5fa' },
  { value: 'high',   label: 'High',   color: '#fb923c' },
  { value: 'urgent', label: 'Urgent', color: '#f87171' },
] as const;

export const CATEGORIES = [
  { value: 'general',   label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'billing',   label: 'Billing' },
  { value: 'phishing',  label: 'Phishing simulations' },
  { value: 'training',  label: 'Training & courses' },
  { value: 'account',   label: 'Account & access' },
] as const;

export type SupportPriority = (typeof PRIORITIES)[number]['value'];
export type SupportCategory = (typeof CATEGORIES)[number]['value'];
