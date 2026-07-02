const fs = require('fs');
const path = require('path');

const ipePath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');
const adminPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');

// 1. Modify app/nin-services/ipe-clearance.tsx
if (fs.existsSync(ipePath)) {
    let content = fs.readFileSync(ipePath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Update DEFAULT_SLIP_TYPES
    const oldSlipTypes = `const DEFAULT_SLIP_TYPES = [
    { id: 'ipe_slip_regular', db_id: 'ipe_slip_regular', name: 'Regular', price: 0, image: require('../../assets/images/regular.png') },
    { id: 'ipe_slip_premium', db_id: 'ipe_slip_premium', name: 'Premium', price: 150, image: require('../../assets/images/premium.png') }
];`;

    const newSlipTypes = `const DEFAULT_SLIP_TYPES = [
    { id: 'ipe_slip_none', db_id: 'ipe_slip_none', name: 'No Slip', price: 0, image: null },
    { id: 'ipe_slip_regular', db_id: 'ipe_slip_regular', name: 'Regular', price: 0, image: require('../../assets/images/regular.png') },
    { id: 'ipe_slip_premium', db_id: 'ipe_slip_premium', name: 'Premium', price: 150, image: require('../../assets/images/premium.png') }
];`;

    content = content.replace(oldSlipTypes, newSlipTypes);

    // Update slip cell renderer to handle No Slip icon placeholder
    const oldRenderer = `                                    <View style={styles.slipImageBox}>
                                        <Image source={item.image} style={styles.slipPreviewImage} resizeMode="contain" />
                                    </View>`;

    const newRenderer = `                                    <View style={styles.slipImageBox}>
                                        {item.image === null ? (
                                            <Ionicons name="document-text-outline" size={32} color={isSelected ? '#9A3412' : '#64748b'} />
                                        ) : (
                                            <Image source={item.image} style={styles.slipPreviewImage as any} resizeMode="contain" />
                                        )}
                                    </View>`;

    content = content.replace(oldRenderer, newRenderer);

    // Adjust width of slip selector cells to display three items cleanly
    content = content.replace(
        `width: '48.5%',\n        minHeight: 120,`,
        `width: '31.5%',\n        minHeight: 110,`
    );

    fs.writeFileSync(ipePath, content, 'utf8');
    console.log('Successfully added No Slip option to ipe-clearance.tsx!');
}

// 2. Modify app/manage/nin-pricing.tsx
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    const oldSeederBlock = `            // Self-healing database check: Auto-seed IPE Clearance pricing entries if missing
            const { data: ipeCheck, error: ipeError } = await supabase
                .from('service_pricing')
                .select('id')
                .eq('service_category', 'ipe');
            
            if (!ipeError && (!ipeCheck || ipeCheck.length === 0)) {
                const ipePricingDefaults = [
                    { id: 'ipe_inprocessing', service_category: 'ipe', name: 'InProcessing Error', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_still_processed', service_category: 'ipe', name: 'Still Being Processed', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_new_enrollment', service_category: 'ipe', name: 'New Enrollment For Tracking ID', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_invalid_tracking', service_category: 'ipe', name: 'Invalid Tracking ID', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_slip_regular', service_category: 'ipe', name: 'Regular Slip (Clearance)', cost_price: 0, markup_price: 0 },
                    { id: 'ipe_slip_premium', service_category: 'ipe', name: 'Premium Slip (Clearance)', cost_price: 150, markup_price: 0 }
                ];
                await supabase.from('service_pricing').insert(ipePricingDefaults);
            }`;

    const newSeederBlock = `            // Self-healing database check: Auto-seed IPE Clearance pricing entries if missing
            const ipePricingDefaults = [
                { id: 'ipe_inprocessing', service_category: 'ipe', name: 'InProcessing Error', cost_price: 700, markup_price: 0 },
                { id: 'ipe_still_processed', service_category: 'ipe', name: 'Still Being Processed', cost_price: 700, markup_price: 0 },
                { id: 'ipe_new_enrollment', service_category: 'ipe', name: 'New Enrollment For Tracking ID', cost_price: 700, markup_price: 0 },
                { id: 'ipe_invalid_tracking', service_category: 'ipe', name: 'Invalid Tracking ID', cost_price: 700, markup_price: 0 },
                { id: 'ipe_slip_none', service_category: 'ipe', name: 'No Slip (Clearance)', cost_price: 0, markup_price: 0 },
                { id: 'ipe_slip_regular', service_category: 'ipe', name: 'Regular Slip (Clearance)', cost_price: 0, markup_price: 0 },
                { id: 'ipe_slip_premium', service_category: 'ipe', name: 'Premium Slip (Clearance)', cost_price: 150, markup_price: 0 }
            ];

            for (const item of ipePricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }`;

    content = content.replace(oldSeederBlock, newSeederBlock);

    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('Successfully updated seeding block in nin-pricing.tsx!');
}
