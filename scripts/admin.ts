/**
 * Founder admin CLI (billing is manual for the first customers).
 *   npm run admin -- list
 *   npm run admin -- set-plan <email> <basico|comercio|distribuidora|trial> <months>
 *   npm run admin -- extend-trial <email> <days>
 *   npm run admin -- reset-link <email>
 *   npm run admin -- funnel [days]
 *   npm run admin -- delete-org <email> --yes
 * Uses DATABASE_PATH (default ./data/remarca.sqlite).
 */
import { openDb } from '../src/db/index.js';
import { isPlanId, PLANS, accessState } from '../src/lib/plans.js';
import { createPasswordReset } from '../src/services/auth.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'development' });
const db = openDb(config.databasePath);
const [cmd, ...args] = process.argv.slice(2);

function orgByEmail(email: string) {
  const row = db.prepare('SELECT o.* FROM orgs o JOIN users u ON u.org_id = o.id WHERE u.email = ?').get(email.toLowerCase()) as
    | { id: number; name: string; plan: string; trial_ends_at: string; paid_until: string | null }
    | undefined;
  if (!row) throw new Error(`No account with email ${email}`);
  return row;
}

switch (cmd) {
  case 'list': {
    const rows = db
      .prepare(
        `SELECT o.id, o.name, o.plan, o.trial_ends_at, o.paid_until, o.created_at, (SELECT email FROM users WHERE org_id = o.id ORDER BY id LIMIT 1) email,
          (SELECT COUNT(*) FROM products WHERE org_id = o.id) products, (SELECT COUNT(*) FROM suppliers WHERE org_id = o.id AND archived = 0) suppliers,
          (SELECT COUNT(*) FROM imports WHERE org_id = o.id AND status = 'applied') applied
         FROM orgs o ORDER BY o.id DESC`,
      )
      .all() as { id: number; name: string; plan: string; trial_ends_at: string; paid_until: string | null; created_at: string; email: string; products: number; suppliers: number; applied: number }[];
    for (const r of rows) {
      const a = accessState(r);
      console.log(`${r.id}\t${r.email}\t${r.name}\t${a.plan.name}\t${a.active ? `active ${a.daysLeft}d` : 'INACTIVE'}\tproducts=${r.products} suppliers=${r.suppliers} applied=${r.applied}\tsince ${r.created_at.slice(0, 10)}`);
    }
    break;
  }
  case 'set-plan': {
    const [email, plan, months] = args;
    if (!email || !plan || !isPlanId(plan) || !months || !/^\d+$/.test(months)) throw new Error('usage: set-plan <email> <plan> <months>');
    const org = orgByEmail(email);
    const from = org.paid_until && new Date(org.paid_until) > new Date() ? new Date(org.paid_until) : new Date();
    from.setMonth(from.getMonth() + Number(months));
    db.prepare('UPDATE orgs SET plan = ?, paid_until = ? WHERE id = ?').run(plan, plan === 'trial' ? null : from.toISOString(), org.id);
    console.log(`${org.name}: plan ${PLANS[plan].name} until ${from.toISOString().slice(0, 10)}`);
    break;
  }
  case 'extend-trial': {
    const [email, days] = args;
    if (!email || !days || !/^\d+$/.test(days)) throw new Error('usage: extend-trial <email> <days>');
    const org = orgByEmail(email);
    const until = new Date(Math.max(Date.now(), new Date(org.trial_ends_at).getTime()) + Number(days) * 86_400_000);
    db.prepare("UPDATE orgs SET plan = 'trial', trial_ends_at = ? WHERE id = ?").run(until.toISOString(), org.id);
    console.log(`${org.name}: trial until ${until.toISOString().slice(0, 10)}`);
    break;
  }
  case 'reset-link': {
    const [email] = args;
    if (!email) throw new Error('usage: reset-link <email>');
    const r = createPasswordReset(db, email);
    if (!r) throw new Error('No such user');
    console.log(`${config.baseUrl}/restablecer?t=${encodeURIComponent(r.token)}  (valid 1 hour, send it privately)`);
    break;
  }
  case 'funnel': {
    const days = Number(args[0] ?? 30);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const orgs = db.prepare('SELECT id FROM orgs WHERE created_at >= ?').pluck().all(since) as number[];
    const has = (name: string) => (db.prepare(`SELECT COUNT(DISTINCT org_id) FROM events WHERE name = ? AND org_id IN (SELECT id FROM orgs WHERE created_at >= ?)`).pluck().get(name, since) as number) ?? 0;
    const steps = ['signup', 'catalog_imported', 'supplier_created', 'list_uploaded', 'list_applied', 'export_downloaded'];
    console.log(`Accounts created in the last ${days} days: ${orgs.length}`);
    for (const s of steps) console.log(`  ${s.padEnd(20)} ${has(s)}`);
    const retained = db
      .prepare(
        `SELECT COUNT(*) FROM (SELECT org_id FROM events WHERE name = 'list_applied' AND org_id IN (SELECT id FROM orgs WHERE created_at >= ?)
         GROUP BY org_id HAVING COUNT(DISTINCT substr(created_at, 1, 10)) >= 2)`,
      )
      .pluck()
      .get(since) as number;
    console.log(`  applied lists on 2+ different days: ${retained}`);
    const paying = db.prepare("SELECT COUNT(*) FROM orgs WHERE plan != 'trial' AND paid_until > ?").pluck().get(new Date().toISOString()) as number;
    console.log(`Paying accounts now: ${paying}`);
    break;
  }
  case 'delete-org': {
    const [email, confirm] = args;
    if (!email || confirm !== '--yes') throw new Error('usage: delete-org <email> --yes   (irreversible; export their data first if they asked for it)');
    const org = orgByEmail(email);
    db.prepare('DELETE FROM orgs WHERE id = ?').run(org.id);
    db.prepare('DELETE FROM events WHERE org_id = ?').run(org.id);
    console.log(`Deleted account ${org.name} (#${org.id}) and all its data.`);
    break;
  }
  default:
    console.log('commands: list | set-plan <email> <plan> <months> | extend-trial <email> <days> | reset-link <email> | funnel [days] | delete-org <email> --yes');
}
db.close();
