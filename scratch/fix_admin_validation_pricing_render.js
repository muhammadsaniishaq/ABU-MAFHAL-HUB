const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Update stylesheet in nin-pricing.tsx to define sectionHeaderTitle style
const targetStyleStart = `const styles = StyleSheet.create({`;
const newStyleEntry = `    sectionHeaderTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 16,
    },`;

content = content.replace(targetStyleStart, `${targetStyleStart}\n${newStyleEntry}`);

// 2. Replace the hardcoded list render block inside the return JSX of nin-pricing.tsx
const oldListBlock = `                    ) : (
                        <View>
                            <Text className="text-slate-500 font-bold text-xs uppercase mb-4 tracking-widest">NIN Verification Slips</Text>
                            {ninPrices.map(renderPriceCard)}

                            <Text className="text-slate-500 font-bold text-xs uppercase my-6 tracking-widest">IPE Clearance Services</Text>
                            {ipePrices.map(renderPriceCard)}
                        </View>
                    )}`;

const newListBlock = `                    ) : (
                        <View>
                            <Text style={styles.sectionHeaderTitle}>
                                {activeTab === 'nin' ? 'NIN Verification Slips' : 
                                 activeTab === 'ipe' ? 'IPE Clearance Services' : 
                                 'NIN Validation Services'}
                            </Text>
                            {filteredPrices.map(renderPriceCard)}
                        </View>
                    )}`;

content = content.replace(oldListBlock, newListBlock);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully fixed validation pricing rendering in nin-pricing.tsx!');
