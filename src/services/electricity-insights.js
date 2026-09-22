const { number, round, periodIndex, periodKey } = require('../parsers/electricity-details');

function ratio(amount, units) {
    return amount !== null && units !== null && units > 0 ? round(amount / units) : null;
}

function comparison(current, previous) {
    if (current === null || previous === null) return null;
    return { previous, change: round(current - previous),
        percent_change: previous > 0 ? round((current - previous) / previous * 100) : null };
}

function protectionInsight(data, history, units) {
    const category = String(data.category || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const status = category === 'protected' ? 'protected'
        : ['unprotected', 'nonprotected'].includes(category) ? 'unprotected'
        : category.includes('lifeline') ? 'lifeline' : 'unknown';
    const period = periodIndex(data.billPeriod);
    const domestic = /^domestic|^residential/i.test(data.tariffCategory || '') || /^A-?1/i.test(data.tariff || '');
    const load = number(data.sanctionedLoad);
    const timeOfUse = /time.of.use|\bTOU\b|A-?1\s*\(?b\)?/i.test(data.tariff || '');
    const applicable = domestic && !timeOfUse && load !== null && load > 0 && load < 5;
    const rows = new Map();
    const duplicates = new Set();
    for (const row of history) {
        const index = periodIndex(row.month);
        if (rows.has(index)) duplicates.add(index);
        rows.set(index, row.units);
    }
    let streak = 0;
    let complete = period !== null && units !== null && units >= 0;
    let boundary = false;
    const evidence = [];
    if (complete) {
        for (let i = 0; i < 6; i += 1) {
            const index = period - i;
            const value = i === 0 ? units : rows.get(index);
            if (value === undefined || value === null || value < 0 || duplicates.has(index)) {
                complete = false;
                break;
            }
            evidence.push({ period: periodKey(index), units: value, within_limit: value <= 200 });
            if (value > 200) { boundary = true; break; }
            streak += 1;
        }
    }
    const knownWindow = complete && (streak === 6 || boundary);
    const remaining = status === 'protected' ? 0
        : status === 'unprotected' && applicable && knownWindow ? 6 - streak : null;
    return {
        status, source: 'provider_category', eligible_tariff_scope: applicable ? true : domestic && load === null ? null : false,
        monthly_limit_units: 200, monthly_limit_kwh: 200, required_consecutive_months: 6,
        observed_qualifying_months: streak, history_sufficient: knownWindow, evidence,
        additional_qualifying_bills_needed: remaining,
        estimated_qualification_period: status === 'unprotected' && remaining !== null
            ? periodKey(period + remaining) : null,
        estimated_first_protected_bill_period: status === 'unprotected' && remaining !== null
            ? periodKey(period + remaining + 1) : null,
        billed_units_below_limit: units !== null ? Math.max(0, 200 - units) : null,
        estimate_only: status !== 'protected',
        note: status === 'protected' ? 'The provider already classifies this bill as protected.'
            : !applicable ? 'A protection countdown needs a confirmed domestic non-TOU tariff with sanctioned load below 5 kW.'
            : !knownWindow ? 'Insufficient consecutive monthly readings for a reliable countdown.'
            : 'Assumes each future billed month remains at or below 200 units. The first-protected-bill month is a planning estimate after six qualifying bills; the utility determines actual classification.',
        rule: 'Domestic non-TOU consumers: at most 200 units per month over the preceding six months.',
        rule_source: 'https://nepra.org.pk/tariff/Distribution%20PESCO.php',
        rule_verification: 'The six-month window is a planning assumption pending confirmation against the latest eligibility notification; the 200-unit tariff bands and provider category were verified.',
        pro_rata: /pro.?rata/i.test(data.meterStatus || ''),
        pro_rata_note: /pro.?rata/i.test(data.meterStatus || '')
            ? 'Use billed/pro-rated units. Carried-forward units and actual meter readings can differ; the displayed margin is not a live remaining allowance.' : null,
    };
}

function buildInsights(data, charges, history) {
    const units = number(data.units);
    const payable = number(data.currentBill);
    const period = periodIndex(data.billPeriod);
    const previous = history.find(row => periodIndex(row.month) === period - 1);
    const lastYear = history.find(row => periodIndex(row.month) === period - 12);
    const valid = history.filter(row => row.units !== null && row.units >= 0);
    const totalUnits = valid.reduce((sum, row) => sum + row.units, 0);
    const billRows = history.filter(row => row.bill_amount !== null);
    const paymentRows = history.filter(row => row.payment_amount !== null);
    const protection = protectionInsight(data, history, units);
    const cost = {
        currency: 'PKR', unit: 'unit',
        average_energy_only: ratio(charges.energy.variable_charges, units),
        average_current_bill: ratio(charges.summary['Current Bill'] ?? null, units),
        effective_payable: ratio(payable, units),
        fixed_charges_per_unit: ratio(charges.energy.fixed_charges, units),
        taxes_per_current_unit: ratio(charges.taxes.combined_total, units),
        marginal_energy_rate: charges.energy.slabs.at(-1)?.rate_per_kwh ?? null,
        explanation: 'Effective payable includes fixed charges, taxes, adjustments and possibly arrears. FPA relates to an earlier consumption month. These averages are not the tariff or a guaranteed saving per unit.',
    };
    const suggestions = [];
    if (protection.status === 'protected' && units !== null) suggestions.push({ code: 'KEEP_PROTECTED',
        message: `Keep each billed month at or below 200 units. This bill uses ${units} units; its margin to 200 is ${protection.billed_units_below_limit} units. Track actual readings and any pro-rata carry-forward.` });
    if (protection.status === 'unprotected' && protection.eligible_tariff_scope) suggestions.push({ code: 'REGAIN_PROTECTION',
        message: protection.additional_qualifying_bills_needed === null
            ? 'Collect consecutive bills and target at most 200 units per billing month; current history cannot establish a conversion date.'
            : `Target at most 200 units per billed month for ${protection.additional_qualifying_bills_needed} more qualifying bills. Utility confirmation is needed before assuming protected rates.` });
    if (previous && units !== null && previous.units !== null && units > previous.units) suggestions.push({ code: 'USAGE_INCREASE',
        message: `Consumption rose by ${round(units - previous.units)} units from last month. Compare cooling, heating and pump operating hours, as well as the billed reading period.` });
    const scenarios = [];
    if (units > 0 && charges.energy.slabs_verified) {
        // Value reductions using the highest billed slabs first, with the same
        // tariff/status. Never apply the all-in average to a savings estimate.
        for (const percent of [10, 20]) {
            const reduction = round(units * percent / 100);
            let remaining = reduction;
            let saved = 0;
            for (const slab of [...charges.energy.slabs].reverse()) {
                const take = Math.min(remaining, slab.units);
                saved += take * slab.rate_per_kwh;
                remaining -= take;
                if (remaining <= 0) break;
            }
            scenarios.push({ reduction_percent: percent, units_saved: reduction,
                target_units: round(units - reduction), estimated_energy_charge_saving: round(saved),
                assumptions: 'Same billed energy slabs and consumer status; excludes changes to fixed charges, taxes, FPA, quarterly adjustments and rounding.' });
        }
        suggestions.push({ code: 'REDUCE_RUNTIME', message: 'Start with high-power appliances such as cooling, heating and water pumps. Reducing their daily runtime usually has the clearest effect on units consumed.' });
    }
    if (data.paid) suggestions.push({ code: 'PAYMENT_RECORDED', message: 'Payment is already recorded for this bill; retain the receipt.' });
    else if (data.paid === false && data.dueDate) suggestions.push({ code: 'PAY_BY_DUE_DATE', message: 'Pay by the printed due date to avoid late-payment charges.' });
    const summary = charges.summary;
    const currentCalculated = ['variable_charges','fixed_charges','meter_rent','service_rent','financing_cost_surcharge','quarterly_adjustment']
        .every(key => charges.energy[key] !== null) && charges.taxes.current.reported_total !== null
        ? round(charges.energy.variable_charges + charges.energy.fixed_charges + (charges.energy.meter_rent ?? 0) +
            (charges.energy.service_rent ?? 0) + (charges.energy.financing_cost_surcharge ?? 0) +
            (charges.energy.quarterly_adjustment ?? 0) + charges.taxes.current.reported_total) : null;
    const summaryParts = ['Current Bill', 'Arrears', 'Installment', 'Adjustments', 'W.E Credit', 'Lock Open Credit', 'Total FPA'];
    // Preserve the provider's credit signs; do not guess missing summary rows.
    const summaryTotal = summaryParts.every(key => summary[key] !== undefined && summary[key] !== null) &&
        summary['W.E Credit'] <= 0 && summary['Lock Open Credit'] <= 0
        ? round(summaryParts.reduce((sum, key) => sum + summary[key], 0)) : null;
    return {
        cost_per_unit: cost, protection, savings: { suggestions, scenarios },
        consumption: { current_units: units, months_in_history: history.length,
            observed_history_units: valid.length ? round(totalUnits) : null,
            average_historical_units: valid.length ? round(totalUnits / valid.length) : null,
            highest_usage: valid.length ? valid.reduce((a,b) => a.units >= b.units ? a : b) : null,
            lowest_usage: valid.length ? valid.reduce((a,b) => a.units <= b.units ? a : b) : null,
            month_over_month: comparison(units, previous?.units ?? null),
            year_over_year: comparison(units, lastYear?.units ?? null),
            months_above_200: valid.filter(row => row.units > 200).map(row => row.period),
            historical_bill_total: billRows.length ? round(billRows.reduce((sum,row) => sum + row.bill_amount,0)) : null,
            historical_payment_total: paymentRows.length ? round(paymentRows.reduce((sum,row) => sum + row.payment_amount,0)) : null,
            payment_note: 'Historical payments may include arrears or credits; the difference from billed amounts is not a current outstanding balance.' },
        reconciliation: { current_bill_from_components: currentCalculated,
            printed_current_bill: summary['Current Bill'] ?? null,
            current_bill_rounding_difference: currentCalculated !== null && summary['Current Bill'] !== undefined && summary['Current Bill'] !== null
                ? round(summary['Current Bill'] - currentCalculated) : null,
            summary_component_total: summaryTotal,
            payable_difference_from_summary: summaryTotal !== null && payable !== null ? round(payable - summaryTotal) : null,
            note: 'Summary amounts are rounded by the provider; detailed QR components retain decimal precision. FPA taxes are separate from current-month taxes.' },
    };
}

module.exports = { buildInsights, protectionInsight };
