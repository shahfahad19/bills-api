const ELECTRICITY_PROVIDERS = {
    11: { company: 'LESCO', slug: 'lescobill' },
    12: { company: 'GEPCO', slug: 'gepcobill' },
    13: { company: 'FESCO', slug: 'fescobill' },
    14: { company: 'IESCO', slug: 'iescobill' },
    15: { company: 'MEPCO', slug: 'mepcobill' },
    26: { company: 'PESCO', slug: 'pescobill' },
    37: { company: 'HESCO', slug: 'hescobill' },
    38: { company: 'SEPCO', slug: 'sepcobill' },
};

function getBillType(reference) {
    if (/^\d{11}$/.test(reference)) return 'gas';
    if (/^\d{14}$/.test(reference)) return 'electricity';
    return null;
}

function getElectricityProvider(reference, companyOverride) {
    const code = Number(reference.slice(2, 4));
    const provider = ELECTRICITY_PROVIDERS[code];

    if (provider) {
        return {
            ...provider,
            url: `https://bill.pitc.com.pk/${provider.slug}`,
        };
    }

    // Preserve the legacy fallback while allowing the app to send the company.
    const company = String(companyOverride || 'QESCO').toUpperCase();
    const slug = `${company.toLowerCase()}bill`;
    return { company, slug, url: `https://bill.pitc.com.pk/${slug}` };
}

module.exports = { getBillType, getElectricityProvider };
