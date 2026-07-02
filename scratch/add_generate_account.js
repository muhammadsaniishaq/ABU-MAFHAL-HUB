const fs = require('fs');

const FILE_PATH = 'c:\\ABU-MAFHAL-HUB\\app\\manage\\users.tsx';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Add state for account generation
if (!content.includes('const [bvnInput, setBvnInput] = useState')) {
    content = content.replace(
        `const [showNotifyInput, setShowNotifyInput] = useState(false);`,
        `const [showNotifyInput, setShowNotifyInput] = useState(false);\n    const [showGenerateAccount, setShowGenerateAccount] = useState(false);\n    const [bvnInput, setBvnInput] = useState('');`
    );
}

// 2. Add executeAction logic for generate_account
const executeActionNotifyReal = `else if (pendingAction.type === 'notify') {`;

const executeGenerateAccount = `else if (pendingAction.type === 'generate_account') {
                const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                    body: { userId: selectedUser.id, bvn: bvnInput }
                });
                
                if (error) throw new Error(error.message || "Failed to generate account");
                if (data?.error) throw new Error(data.error);

                Alert.alert("Success", "Virtual account generated successfully!");
                setShowGenerateAccount(false);
                setBvnInput('');
                
                // Refresh profile to show new account number
                const { data: updatedProfile } = await supabase.from('profiles').select('account_number').eq('id', selectedUser.id).single();
                if (updatedProfile) {
                    setSelectedUser({ ...selectedUser, account_number: updatedProfile.account_number });
                }
            }
            else if (pendingAction.type === 'notify') {`;

if (!content.includes(`pendingAction.type === 'generate_account'`)) {
    content = content.replace(executeActionNotifyReal, executeGenerateAccount);
}

// 3. Add UI Button for Generate Account
const quickActionsEnd = `                                </View>

                                {showNotifyInput && (`;

const generateAccountUI = `                                    <TouchableOpacity onPress={() => setShowGenerateAccount(!showGenerateAccount)} className="w-[48%] bg-teal-50 border border-teal-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="card-outline" size={14} color="#0D9488" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-teal-700">Gen Account</Text>
                                    </TouchableOpacity>
                                </View>

                                {showGenerateAccount && (
                                    <View className="bg-teal-50 p-4 rounded-xl mb-6 border border-teal-200 shadow-sm">
                                        <Text className="text-teal-800 font-bold text-[10px] uppercase tracking-widest mb-2">Generate Virtual Account (KYC)</Text>
                                        <TextInput
                                            placeholder="Enter BVN/NIN (Optional if already in DB)"
                                            className="bg-white border border-teal-100 rounded-lg p-3 text-teal-900 text-sm mb-3"
                                            value={bvnInput}
                                            onChangeText={setBvnInput}
                                            keyboardType="numeric"
                                        />
                                        <TouchableOpacity onPress={() => { setPendingAction({ type: 'generate_account' }); setShowSecurity(true); }} className="bg-[#0D9488] py-2.5 rounded-lg items-center shadow-sm">
                                            <Text className="text-white font-bold text-xs uppercase tracking-widest">Generate Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showNotifyInput && (`;

if (!content.includes('Generate Virtual Account (KYC)')) {
    content = content.replace(quickActionsEnd, generateAccountUI);
}

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log("Successfully added Generate Account feature to users.tsx.");
