// 프로젝트 루트에서 node docs/task-review/verify-review.cjs 로 실행한다.
// 원본 파일은 읽기만 한다. 비용 가정은 W02 최종 검토 의견과 같다.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = '01_참가자_배포용/04_원본데이터';
function csv(file) {
  const [header, ...lines] = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const keys = header.split('|');
  return lines.map(line => Object.fromEntries(line.split('|').map((value, i) => [keys[i], value])));
}
const sum = (rows, key) => rows.reduce((n, row) => n + Number(row[key]), 0);
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const ms = '02_masil/';
const cv = '01_corevia/';
const daily = csv(ms + 'financials/fin_cash_daily_ms.csv');
const ar = csv(ms + 'financials/fin_ar_aging_ms.csv');
const ap = csv(ms + 'financials/fin_ap_aging_ms.csv').filter(r => r.po_id === 'NONE');
const po = csv(ms + 'inventory/sc_purchase_orders_ms.csv');
let cash = Number(daily.at(-1).closing_balance);
const cashByDate = {};
for (let date = new Date('2026-07-01T00:00:00Z'); date <= new Date('2026-09-29T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
  const day = date.toISOString().slice(0, 10);
  cash += sum(ar.filter(r => r.due_date === day), 'outstanding_krw') - sum(ap.filter(r => r.payment_due_date === day), 'amount_krw') - sum(po.filter(r => r.payment_due_date === day), 'amount_krw');
  cashByDate[day] = cash;
}
near(cashByDate['2026-07-21'], 2191749959);
near(Math.min(...Object.values(cashByDate)), 1921839555);
near(cashByDate['2026-08-23'], 3328583411);
near(sum(po, 'amount_krw'), 3749760000);

const campaigns = csv(ms + 'master/m_campaign_ms.csv');
const campaignMap = new Map(campaigns.map(r => [r.campaign_id, r]));
const orders = csv(ms + 'marketing/mkt_orders_ms.csv');
const orderMap = new Map(orders.map(r => [r.order_id, r]));
const returns = csv(ms + 'marketing/mkt_returns_ms.csv').filter(r => r.refund_completed_date <= '2026-07-01');
const costs = new Map(csv(ms + 'marketing/mkt_cost_master_ms.csv').map(r => [r.sku_id + '|' + r.channel_id, r]));
const ads = csv(ms + 'marketing/mkt_ad_spend_ms.csv');
const plans = csv(ms + 'marketing/mkt_budget_plan_ms.csv');
const result = {};
for (const influencer of ['INF-001', 'INF-005', 'INF-002']) {
  const selected = orders.filter(r => campaignMap.get(r.campaign_id).influencer_id === influencer);
  const related = returns.filter(r => campaignMap.get(orderMap.get(r.order_id).campaign_id).influencer_id === influencer);
  const spend = sum(ads.filter(r => campaignMap.get(r.campaign_id).influencer_id === influencer), 'ad_cost_krw');
  const baseCosts = selected.reduce((n, r) => { const c = costs.get(r.sku_id + '|' + r.channel_id); return n + Number(c.product_cost_krw) + Number(c.shipping_cost_krw) + Number(r.gmv_krw) * Number(c.channel_fee_pct) / 100; }, 0);
  const returnCosts = related.reduce((n, r) => { const o = orderMap.get(r.order_id); return n + Number(costs.get(o.sku_id + '|' + o.channel_id).return_logistics_cost_krw); }, 0);
  const profit = sum(selected, 'gmv_krw') - sum(related, 'refund_amount_krw') - baseCosts - returnCosts - spend;
  result[influencer] = { profit, roas: profit / spend };
}
near(result['INF-001'].profit, -61308789.44);
near(result['INF-001'].roas, -0.198, 0.001);
near(result['INF-005'].roas, -0.214, 0.001);
near(result['INF-002'].roas, 3.703, 0.001);
assert.equal(plans.filter(r => campaignMap.get(r.campaign_id).country !== '국내').length, 15);
// 30억원 하회 구간에 집행일이 드는 기안은 금액과 무관하게 그룹 CEO 승인 대상이다.
const dipDays = Object.keys(cashByDate).filter(day => cashByDate[day] < 3e9);
assert.deepEqual([dipDays[0], dipDays.at(-1), dipDays.length], ['2026-07-21', '2026-08-22', 33]);
const plansInDip = plans.filter(r => dipDays.includes(r.settlement_date));
assert.equal(plansInDip.length, 12);
near(sum(plansInDip, 'requested_budget_krw'), 99550557);
near(sum(plansInDip, 'requested_budget_krw') / sum(plans, 'requested_budget_krw') * 100, 55.06);
assert.deepEqual(plansInDip.filter(r => r.contract_deadline === '2026-07-17').map(r => r.plan_id), ['PLAN-001', 'PLAN-002', 'PLAN-003']);
const countryByCustomer = new Map(orders.map(r => [r.customer_ref, r.country]));
const repurchase = csv(ms + 'marketing/mkt_repurchase_ms.csv');
const matureBefore = new Date(Date.parse('2026-07-01T00:00:00Z') - 90 * 86400000).toISOString().slice(0, 10);
const matureCounts = {};
for (const country of ['일본', '미국', '동남아', '국내']) {
  const rows = repurchase.filter(r => countryByCustomer.get(r.customer_ref) === country && r.first_order_date <= matureBefore);
  matureCounts[country] = [rows.filter(r => r.reorder_within_90d === 'True').length, rows.length];
}
assert.deepEqual(matureCounts, { 일본: [231,2464], 미국: [244,2222], 동남아: [197,1797], 국내: [589,4204] });

const claims = csv(cv + 'quality/qc_claims_cv.csv');
const batches = csv(cv + 'production/prod_batch_log_cv.csv');
const sbl = csv(cv + 'quality/shipment_batch_link_cv.csv');
const problem = ['B-02-2602-01', 'B-02-2603-01'];
const linked = new Set(sbl.map(r => r.batch_id + '|' + r.customer_id));
assert.equal(claims.filter(r => !linked.has(r.batch_id + '|' + r.customer_id)).length, 111);
assert.equal(claims.filter(r => problem.includes(r.batch_id) && r.customer_id === 'C-105' && !linked.has(r.batch_id + '|' + r.customer_id)).length, 14);
near(sum(sbl.filter(r => problem.includes(r.batch_id) && r.customer_id === 'C-103'), 'shipped_qty'), 83402);
near(sum(claims.filter(r => r.batch_id === problem[0] && r.defect_confirmed === 'True'), 'qty_affected'), 17900);
near(sum(claims.filter(r => r.batch_id === problem[1] && r.defect_confirmed === 'True'), 'qty_affected'), 18622);
const purchases = csv(cv + 'procurement/procurement_material_purchase_cv.csv').filter(r => r.purchase_date.startsWith('2025'));
near(sum(purchases, 'amount_krw'), 14261720168);
near(sum(purchases.filter(r => r.material_id === 'M-B'), 'amount_krw'), 8455149159);
near(sum(batches.filter(r => r.product_id === 'PL-02' && r.production_date >= '2026-01-01' && r.production_date <= '2026-06-30'), 'produced_qty'), 2873915);
const shipments = csv(cv + 'sales/sales_shipments_cv.csv');
const shippedOrders = new Set(shipments.map(r => r.order_id));
const unshipped = csv(cv + 'sales/sales_orders_cv.csv').filter(r => !shippedOrders.has(r.order_id));
assert.equal(unshipped.length, 1814);
assert.equal(unshipped.filter(r => r.order_date >= '2026-04-01').length, 1232);
const agencies = csv(cv + 'master/m_agency_cv.csv');
const group = new Set(['D-011']);
let changed;
do { changed = false; for (const a of agencies) for (const b of agencies) if (group.has(a.agency_id) && !group.has(b.agency_id) && ['representative_name','address','bank_account_no'].filter(k => a[k] === b[k] && a[k] !== 'NONE' && a[k] !== '').length >= 2) { group.add(b.agency_id); changed = true; } } while(changed);
assert.deepEqual([...group].sort(), ['D-011','D-024','D-037']);
near(sum(csv(cv + 'sales/sales_rebate_payment_cv.csv').filter(r => group.has(r.agency_id) && r.period_ym === '2026-06'), 'rebate_amount_krw'), 3888097);
const quarterly = csv('04_celtonic_labs/financials/celtonic_quarterly_pl.csv');
near(sum(quarterly.filter(r => ['2025Q3','2025Q4','2026Q1','2026Q2'].includes(r.period)), 'ebitda_krw'), 2226630000);

const reviewDir = 'docs/task-review';
const summary = fs.readFileSync(path.join(reviewDir, '00_종합_업무선택.md'), 'utf8');
for (const name of fs.readdirSync(reviewDir).filter(n => /^W\d\d_.*\.md$/.test(n))) {
  const content = fs.readFileSync(path.join(reviewDir, name), 'utf8');
  const match = content.match(/최종 (\d+)\/100[\s\S]*?= \*\*(\d+) \/ (\d+) \/ (\d+) \/ (\d+)\*\*/);
  assert.ok(match, name);
  assert.equal(Number(match[1]), match.slice(2).reduce((n, s) => n + Number(s), 0), name);
  const row = summary.split(/\r?\n/).find(line => line.startsWith('|') && line.includes(name.slice(0,3) + ' ') && line.includes('**' + match[1] + '**'));
  assert.ok(row, 'Summary score mismatch: ' + name);
}
for (const name of fs.readdirSync(reviewDir).filter(n => n.endsWith('.md'))) {
  const content = fs.readFileSync(path.join(reviewDir, name), 'utf8');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(reviewDir, match[1])), 'Broken link in ' + name + ': ' + match[1]);
  }
}
console.log(JSON.stringify({status:'PASS', cash:{july21:cashByDate['2026-07-21'],minimum:Math.min(...Object.values(cashByDate)),august23:cashByDate['2026-08-23']},influencers:result,matureRepurchase:matureCounts,relatedGroup:[...group].sort(),reviewScores:'8 files checked'},null,2));
