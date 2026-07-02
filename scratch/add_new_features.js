const fs = require('fs');

const FILE_PATH = 'c:\\ABU-MAFHAL-HUB\\app\\manage\\users.tsx';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Update executeAction for notify and delete_user
const executeActionNotifyMock = `else if (pendingAction.type === 'notify') {
                Alert.alert("Sent", "Notification sent successfully!");
                setNotifyMessage('');
                setShowNotifyInput(false);
            }`;

const executeActionNotifyReal = `else if (pendingAction.type === 'notify') {
                const { error } = await supabase.from('notifications').insert({
                    user_id: selectedUser.id,
                    title: 'Admin Message',
                    body: notifyMessage,
                    is_read: false
                });
                if (error) throw error;
                Alert.alert("Sent", "Notification sent successfully!");
                setNotifyMessage('');
                setShowNotifyInput(false);
            }
            else if (pendingAction.type === 'delete_user') {
                const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Deleted", "User has been permanently deleted!");
            }`;

content = content.replace(executeActionNotifyMock, executeActionNotifyReal);


// 2. Add initiateDelete
const initiateDeleteStr = `const toggleKyc = () => {`;
const initiateDeleteInject = `const initiateDelete = () => {
        setPendingAction({ type: 'delete_user' });
        Alert.alert("Delete User", \`Are you sure you want to PERMANENTLY delete \${selectedUser?.full_name}? This action cannot be undone and may fail if the user has transaction history.\`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive', onPress: () => setShowSecurity(true) }
        ]);
    };

    const toggleKyc = () => {`;
if(!content.includes('initiateDelete = () =>')) {
    content = content.replace(initiateDeleteStr, initiateDeleteInject);
}

// 3. Add to Quick Actions UI
const quickActionsEnd = `                                </View>

                                {/* Compact Transactions */}`;

const moreActionsUI = `                                    <TouchableOpacity onPress={toggleKyc} className="w-[48%] bg-sky-50 border border-sky-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name={selectedUser?.kyc_verified ? "checkmark-done-circle" : "shield-checkmark-outline"} size={14} color="#0284C7" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-sky-700">{selectedUser?.kyc_verified ? 'Revoke KYC' : 'Verify KYC'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => copyToClipboard(selectedUser?.id || '', 'User ID')} className="w-[48%] bg-slate-50 border border-slate-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="copy-outline" size={14} color="#475569" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-slate-700">Copy ID</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowNotifyInput(!showNotifyInput)} className="w-[48%] bg-indigo-50 border border-indigo-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#4F46E5" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-indigo-700">Message</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateDelete} className="w-[48%] bg-red-50 border border-red-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-red-700">Delete</Text>
                                    </TouchableOpacity>
                                </View>

                                {showNotifyInput && (
                                    <View className="bg-indigo-50 p-4 rounded-xl mb-6 border border-indigo-200 shadow-sm">
                                        <Text className="text-indigo-800 font-bold text-[10px] uppercase tracking-widest mb-2">Send Push Notification</Text>
                                        <TextInput
                                            placeholder="Type message here..."
                                            multiline
                                            className="bg-white border border-indigo-100 rounded-lg p-3 text-indigo-900 text-sm mb-3 min-h-[60px]"
                                            value={notifyMessage}
                                            onChangeText={setNotifyMessage}
                                        />
                                        <TouchableOpacity onPress={sendNotification} className="bg-[#4F46E5] py-2.5 rounded-lg items-center shadow-sm">
                                            <Text className="text-white font-bold text-xs uppercase tracking-widest">Send Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Compact Transactions */}`;

content = content.replace(quickActionsEnd, moreActionsUI);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log("Successfully added new features to UI and connected them to Supabase.");
