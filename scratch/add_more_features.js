const fs = require('fs');

const FILE_PATH = 'c:\\ABU-MAFHAL-HUB\\app\\manage\\users.tsx';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Update Types
content = content.replace(
    `'impersonate' | 'delete_user' | 'generate_account'`,
    `'impersonate' | 'delete_user' | 'generate_account' | 'reset_tx_pin' | 'clear_device'`
);

// 2. Add functions
const initiateDeleteStr = `const initiateDelete = () => {`;
const injectNewFunctions = `const initiateResetTxPin = () => {
        setPendingAction({ type: 'reset_tx_pin' });
        Alert.alert("Reset Transaction PIN", \`Are you sure you want to reset the 4-digit Transaction PIN for \${selectedUser?.full_name}?\`, [
            { text: "Cancel", style: "cancel" },
            { text: "Reset PIN", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateClearDevice = () => {
        setPendingAction({ type: 'clear_device' });
        Alert.alert("Clear Device", \`This will unlink the current device (Push Token) from \${selectedUser?.full_name}'s account. Continue?\`, [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateDelete = () => {`;

if (!content.includes('initiateResetTxPin')) {
    content = content.replace(initiateDeleteStr, injectNewFunctions);
}

// 3. Update executeAction
const deleteUserActionStr = `else if (pendingAction.type === 'delete_user') {
                const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Deleted", "User has been permanently deleted!");
            }`;

const executeNewActions = `else if (pendingAction.type === 'delete_user') {
                const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Deleted", "User has been permanently deleted!");
            }
            else if (pendingAction.type === 'reset_tx_pin') {
                const { error } = await supabase.from('profiles').update({ transaction_pin: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("PIN Reset", "User's transaction PIN has been cleared. They will be asked to set a new one.");
            }
            else if (pendingAction.type === 'clear_device') {
                const { error } = await supabase.from('profiles').update({ push_token: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Device Cleared", "The user's registered device has been unlinked.");
            }`;

if (!content.includes(`pendingAction.type === 'reset_tx_pin'`)) {
    content = content.replace(deleteUserActionStr, executeNewActions);
}

// 4. Update UI Buttons
const genAccountUIStr = `<TouchableOpacity onPress={() => setShowGenerateAccount(!showGenerateAccount)} className="w-[48%] bg-teal-50 border border-teal-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="card-outline" size={14} color="#0D9488" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-teal-700">Gen Account</Text>
                                    </TouchableOpacity>`;

const uiNewButtons = `<TouchableOpacity onPress={() => setShowGenerateAccount(!showGenerateAccount)} className="w-[48%] bg-teal-50 border border-teal-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="card-outline" size={14} color="#0D9488" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-teal-700">Gen Account</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetTxPin} className="w-[48%] bg-orange-50 border border-orange-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="keypad" size={14} color="#EA580C" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-orange-700">Reset Tx PIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateClearDevice} className="w-[48%] bg-gray-50 border border-gray-300 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="hardware-chip-outline" size={14} color="#4B5563" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-gray-700">Unlink Device</Text>
                                    </TouchableOpacity>`;

if (!content.includes('Reset Tx PIN')) {
    content = content.replace(genAccountUIStr, uiNewButtons);
}

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log("Successfully added Reset Tx PIN and Unlink Device.");
