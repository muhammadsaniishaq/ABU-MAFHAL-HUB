const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Replace fetchPrices function entirely with a clean query
const oldFetchPrices = `    const fetchPrices = async () => {
        setLoading(true);
        try {
            // Check & seed missing IPE items
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
            }

            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe'])
                .order('name', { ascending: true });

            if (error) throw error;
            setPrices(data || []);
            setOriginalPrices(JSON.parse(JSON.stringify(data || []))); // Deep copy
        } catch (error: any) {
            showAlert('Database Error', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };`;

const newFetchPrices = `    const fetchPrices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe', 'validation'])
                .order('name', { ascending: true });

            if (error) throw error;
            setPrices(data || []);
            setOriginalPrices(JSON.parse(JSON.stringify(data || []))); // Deep copy
        } catch (error: any) {
            showAlert('Database Error', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };`;

if (content.includes(oldFetchPrices)) {
    content = content.replace(oldFetchPrices, newFetchPrices);
    console.log('Successfully replaced old fetchPrices with clean query.');
} else {
    // If not matching precisely, let's target by indices
    const startIdx = content.indexOf('const fetchPrices = async () => {');
    const endIdx = content.indexOf('    const updateMarkup = (id: string, newMarkup: string) => {');
    if (startIdx !== -1 && endIdx !== -1) {
        content = content.slice(0, startIdx) + newFetchPrices + '\n\n' + content.slice(endIdx);
        console.log('Successfully replaced fetchPrices using indices.');
    } else {
        console.error('Target fetchPrices block not found.');
    }
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Finished running fix_admin_nin_pricing_select.js.');
