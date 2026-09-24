/** Single source of truth for plans and limits (see docs/08-pricing.md). */

export type PlanId = 'trial' | 'basico' | 'comercio' | 'distribuidora';

export interface Plan {
  id: PlanId;
  name: string;
  suppliers: number;
  products: number;
  users: number;
  monthlyArs: number;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: { id: 'trial', name: 'Prueba', suppliers: 40, products: 30_000, users: 3, monthlyArs: 0 },
  basico: { id: 'basico', name: 'Básico', suppliers: 10, products: 5_000, users: 1, monthlyArs: 23_000 },
  comercio: { id: 'comercio', name: 'Comercio', suppliers: 40, products: 30_000, users: 3, monthlyArs: 45_000 },
  distribuidora: { id: 'distribuidora', name: 'Distribuidora', suppliers: 150, products: 150_000, users: 10, monthlyArs: 90_000 },
};

export const TRIAL_DAYS = 14;

export function isPlanId(v: string): v is PlanId {
  return v in PLANS;
}

export interface OrgBilling {
  plan: string;
  trial_ends_at: string;
  paid_until: string | null;
}

/** Whether the account can create/modify data. Expired accounts stay readable and exportable. */
export function accessState(org: OrgBilling, now = new Date()): { active: boolean; plan: Plan; daysLeft: number | null } {
  const plan = isPlanId(org.plan) ? PLANS[org.plan] : PLANS.trial;
  if (plan.id === 'trial') {
    const ends = new Date(org.trial_ends_at).getTime();
    const daysLeft = Math.ceil((ends - now.getTime()) / 86_400_000);
    return { active: daysLeft > 0, plan, daysLeft: Math.max(0, daysLeft) };
  }
  const until = org.paid_until ? new Date(org.paid_until).getTime() : 0;
  const daysLeft = Math.ceil((until - now.getTime()) / 86_400_000);
  return { active: daysLeft > 0, plan, daysLeft: Math.max(0, daysLeft) };
}
