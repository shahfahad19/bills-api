const { round, periodIndex, periodKey } = require('../parsers/electricity-details');

const precise = value => Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 10000) / 10000 : null;
const ratio = (amount, units) => amount !== null && units > 0 ? round(amount / units) : null;
const sum = values => values.every(Number.isFinite) ? round(values.reduce((total,value) => total + value,0)) : null;
const compare = (current, previous) => current === null || previous == null ? null : {
    previous, change:precise(current - previous), percent_change:previous > 0 ? round((current - previous) / previous * 100) : null,
};

function gasProtection(tariff, billPeriod, units, history) {
    const status = /^DOMP(?:-G)?$/i.test(tariff || '') ? 'protected'
        : /^DOMU(?:-G)?$/i.test(tariff || '') ? 'unprotected' : 'unknown';
    const index = periodIndex(billPeriod);
    const year = index === null ? null : Math.floor(index / 12);
    // Last completed November-February window, anchored to the bill month,
    // not today's date. Gas has a seasonal test, not an electricity streak.
    const endYear = year === null ? null : index % 12 >= 1 ? year : year - 1;
    const byPeriod = new Map();
    for (const row of history) {
        const key = periodIndex(row.month);
        byPeriod.set(key, byPeriod.has(key) ? null : row.units);
    }
    if (index !== null) byPeriod.set(index,units);
    const evidence = endYear === null ? [] : [endYear*12-2,endYear*12-1,endYear*12,endYear*12+1]
        .map(key => ({period:periodKey(key),units_hm3:byPeriod.get(key) ?? null}));
    const complete = evidence.length === 4 && evidence.every(row => row.units_hm3 !== null && row.units_hm3 >= 0);
    const total = complete ? precise(evidence.reduce((value,row) => value + row.units_hm3,0)) : null;
    const average = complete ? precise(total / 4) : null;
    const nextEndYear = year === null ? null : index % 12 <= 0 ? year : year + 1;
    return { status, source:'provider_tariff_code', tariff_code:tariff,
        winter_months:['November','December','January','February'], average_limit_hm3:0.9,
        last_completed_winter:evidence, history_sufficient:complete,
        winter_total_hm3:total, winter_average_hm3:average,
        meets_historical_average:complete && status !== 'unknown' ? average <= 0.9 : null,
        excess_winter_total_hm3:complete ? precise(Math.max(0,total - 3.6)) : null,
        next_winter_window:status === 'unknown' || nextEndYear === null ? null : {
            start:periodKey(nextEndYear*12-2), end:periodKey(nextEndYear*12+1), total_target_hm3:3.6,
        },
        estimated_first_protected_bill_period:null,
        note:'The provider tariff code determines current status. The November-February average is a historical check; low summer usage does not establish reclassification. SNGPL must confirm when a qualifying winter changes the category. No automatic conversion date is inferred.',
        rule_source:'https://www.ssgc.com.pk/web/?page_id=103',
        rule_basis:'OGRA domestic tariff effective 2025-07-01, published by SSGC; winter-average definition also appears in SNGPL\'s 2023 notification. Recheck when the notified rule changes.',
    };
}

function buildGasInsights({ units, billPeriod, payable, details, normalizationDays }, warn) {
    const { billing:b, meter, history } = details;
    const index = periodIndex(billPeriod);
    const prior = history.find(row => periodIndex(row.month) === index - 1);
    const lastYear = history.find(row => periodIndex(row.month) === index - 12);
    const observations = history.filter(row => row.units !== null);
    const total = observations.reduce((value,row) => value + row.units,0);
    const days = meter.current_reading_date && meter.previous_reading_date
        ? (Date.parse(meter.current_reading_date) - Date.parse(meter.previous_reading_date)) / 86400000 : null;
    const readingDays = days > 0 && days < 400 ? days : null;
    if (days !== null && readingDays === null) warn('meter','INVALID_READING_PERIOD');
    const components = [b.gas_charges,b.provisional_adjustment,b.meter_rent,b.fixed_charges,b.gst,b.rebate_adjustment,b.security_deposit];
    const calculated = sum(components);
    const balance = sum([b.current_month_bill,b.arrears,details.surcharge]);
    const gstBase = sum([b.gas_charges,b.meter_rent,b.fixed_charges]);
    const currentDifference = calculated !== null && b.current_month_bill !== null ? round(b.current_month_bill - calculated) : null;
    if (currentDifference !== null && Math.abs(currentDifference) > 0.02) warn('charges','CURRENT_BILL_MISMATCH');
    const normalizedUnits = units !== null && readingDays && normalizationDays ? precise(units * normalizationDays / readingDays) : null;
    const protection = gasProtection(details.tariff,billPeriod,units,history);
    const suggestions = [];
    if (b.arrears !== null && b.arrears < 0) suggestions.push({code:'CREDIT_REDUCES_PAYABLE',
        message:`A carried credit of Rs ${round(-b.arrears)} reduces this bill's payable. Budget using current-month charges, not this unusually low amount due.`});
    if (protection.status === 'unprotected') suggestions.push({code:'PLAN_WINTER_USAGE',
        message:'Track November-February usage against an average of 0.9 HM3 (3.6 HM3 across four months). Reduce unnecessary water-heater and space-heater runtime; request provider confirmation of reclassification.'});
    if (protection.status === 'protected') suggestions.push({code:'TRACK_WINTER_AVERAGE',
        message:'Monitor all four winter bills to maintain the qualifying average; one low bill is not enough to establish the next category.'});
    if (units > 0) suggestions.push({code:'REDUCE_HOT_WATER_WASTE',
        message:'Reduce unnecessary hot-water use and cooking time. Track consumption between meter readings to see whether changes lower usage.'});
    if (b.fixed_charges > 0) suggestions.push({code:'FIXED_CHARGES_REMAIN',
        message:'Fixed charges and meter rent remain when usage falls. A 10% consumption reduction does not mean a 10% reduction in the total bill.'});
    const formulaMmbtu = units !== null && meter.gcv > 0 ? units * meter.gcv / 281.7385 : null;
    const conversionDifference = formulaMmbtu !== null && meter.mmbtu !== null ? precise(meter.mmbtu - formulaMmbtu) : null;
    const conversionConsistent = conversionDifference === null ? null
        : Math.abs(conversionDifference) <= 0.0005 * meter.gcv / 281.7385 + 0.0005;
    if (conversionConsistent === false) warn('meter','ENERGY_CONVERSION_MISMATCH');
    return {
        cost_per_unit:{currency:'PKR',volume_unit:'HM3', energy_unit:'MMBTU',
            gas_only_per_hm3:ratio(b.gas_charges,units), gas_only_per_mmbtu:ratio(b.gas_charges,meter.mmbtu),
            current_bill_per_hm3:ratio(b.current_month_bill,units), effective_payable_per_hm3:ratio(payable,units),
            fixed_and_meter_share_percent:b.current_month_bill > 0 ? ratio(sum([b.fixed_charges,b.meter_rent]),b.current_month_bill/100) : null,
            note:'HM3 is the bill volume measure (hundreds of cubic metres); MMBTU measures energy. Payable averages include carried balances and are not tariff rates or marginal savings.'},
        consumption:{current_hm3:units,reading_days:readingDays,
            daily_average_hm3:units !== null && readingDays ? precise(units/readingDays) : null,
            normalized_hm3:normalizedUnits, normalization_days:normalizationDays,
            months_in_history:history.length,observed_history_total_hm3:observations.length ? precise(total) : null,
            average_historical_hm3:observations.length ? precise(total/observations.length) : null,
            highest_usage:observations.length ? observations.reduce((a,b) => a.units >= b.units ? a : b) : null,
            month_over_month:compare(units,prior?.units),year_over_year:compare(units,lastYear?.units),
            current_charges_month_over_month:compare(b.current_month_bill,prior?.bill_amount),
            history_note:'Historical payments can settle other months. Payment-minus-bill is not the current account balance.'},
        protection,
        reconciliation:{current_bill_from_components:calculated,current_bill_difference:currentDifference,
            balance_before_rounding:balance,printed_payable:payable,
            payable_difference:balance !== null && payable !== null ? round(payable-balance) : null,
            gst_base_gas_fixed_meter:gstBase,implied_gst_percent:ratio(b.gst,gstBase === null ? null : gstBase/100),
            implied_base_fixed_charge:readingDays && normalizationDays && b.fixed_charges !== null ? round(b.fixed_charges*normalizationDays/readingDays) : null,
            implied_base_meter_rent:readingDays && normalizationDays && b.meter_rent !== null ? round(b.meter_rent*normalizationDays/readingDays) : null,
            calculated_mmbtu:precise(formulaMmbtu),mmbtu_difference:conversionDifference,
            mmbtu_consistent_with_display_precision:conversionConsistent,
            note:'Base fixed charge/rent are inferred using the reading period and printed normalization basis. GST percentage is observed, not a statutory tax assertion. Payable differences are exposed rather than assumed to be rounding.'},
        savings:{suggestions,scenarios:units > 0 ? [10,20].map(percent => ({reduction_percent:percent,
            units_saved_hm3:precise(units*percent/100),target_hm3:precise(units*(1-percent/100)),
            estimated_bill_saving:null,
            note:'Volume target only. Currency savings need verified slab allocation, minimum charges and billing-period rules; the printed tariff table alone does not establish these.'})) : []},
    };
}

module.exports = { buildGasInsights, gasProtection };
