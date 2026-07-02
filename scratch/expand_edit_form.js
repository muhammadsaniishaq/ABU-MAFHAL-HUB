const fs = require('fs');

const FILE_PATH = 'c:\\ABU-MAFHAL-HUB\\app\\manage\\users.tsx';

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Update UserProfile interface
if (!content.includes('bvn?: string;')) {
    content = content.replace('account_number?: string;', 'account_number?: string;\n    bvn?: string;\n    nin?: string;\n    kyc_tier?: number;');
}

// 2. Update editForm initial state definition
const oldEditFormState = `const [editForm, setEditForm] = useState({ 
        full_name: '', 
        phone: '', 
        email: '',
        username: '',
        gender: '',
        dob: '',
        address: '',
        state: '',
        next_of_kin_name: '',
        next_of_kin_phone: ''
    });`;

const newEditFormState = `const [editForm, setEditForm] = useState({ 
        full_name: '', 
        phone: '', 
        email: '',
        username: '',
        gender: '',
        dob: '',
        address: '',
        state: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        custom_id: '',
        account_number: '',
        bvn: '',
        nin: '',
        kyc_tier: '1'
    });`;

content = content.replace(oldEditFormState, newEditFormState);

// 3. Update the useEffect that sets the form data
const oldUseEffect = `setEditForm({
                full_name: user.full_name || '',
                phone: user.phone || '',
                email: user.email || '',
                username: user.username || '',
                gender: user.gender || '',
                dob: user.dob || '',
                address: user.address || '',
                state: user.state || '',
                next_of_kin_name: user.next_of_kin_name || '',
                next_of_kin_phone: user.next_of_kin_phone || ''
            });`;

const newUseEffect = `setEditForm({
                full_name: user.full_name || '',
                phone: user.phone || '',
                email: user.email || '',
                username: user.username || '',
                gender: user.gender || '',
                dob: user.dob || '',
                address: user.address || '',
                state: user.state || '',
                next_of_kin_name: user.next_of_kin_name || '',
                next_of_kin_phone: user.next_of_kin_phone || '',
                custom_id: user.custom_id || '',
                account_number: user.account_number || '',
                bvn: user.bvn || '',
                nin: user.nin || '',
                kyc_tier: user.kyc_tier ? user.kyc_tier.toString() : '1'
            });`;

content = content.replace(oldUseEffect, newUseEffect);

// 4. Update the save query
const oldSaveQuery = `const { error } = await supabase.from('profiles').update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    username: editForm.username,
                    gender: editForm.gender,
                    dob: editForm.dob,
                    address: editForm.address,
                    state: editForm.state,
                    next_of_kin_name: editForm.next_of_kin_name,
                    next_of_kin_phone: editForm.next_of_kin_phone 
                }).eq('id', selectedUser.id);`;

const newSaveQuery = `const { error } = await supabase.from('profiles').update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    username: editForm.username,
                    gender: editForm.gender,
                    dob: editForm.dob,
                    address: editForm.address,
                    state: editForm.state,
                    next_of_kin_name: editForm.next_of_kin_name,
                    next_of_kin_phone: editForm.next_of_kin_phone,
                    custom_id: editForm.custom_id,
                    account_number: editForm.account_number,
                    bvn: editForm.bvn,
                    nin: editForm.nin,
                    kyc_tier: parseInt(editForm.kyc_tier) || 1
                }).eq('id', selectedUser.id);`;

content = content.replace(oldSaveQuery, newSaveQuery);

// 5. Update the UI
// Replace the entire Edit Profile Details block
const oldUIStart = `<View className="p-4 gap-y-3">
                                <Text className="text-[10px] text-[#0A1128] font-black uppercase tracking-widest mb-1">Edit Profile Details</Text>`;
const oldUIEnd = `<TouchableOpacity onPress={() => { setPendingAction({ type: 'edit_profile' }); setShowSecurity(true); }} className="bg-[#0A1128] py-3 rounded-xl items-center shadow-sm mt-2">
                                    <Text className="text-[#D4AF37] font-bold text-xs uppercase tracking-widest">Save Changes</Text>
                                </TouchableOpacity>
                            </View>`;

const newUI = `<View className="p-4 gap-y-3">
                                <Text className="text-[10px] text-[#0A1128] font-black uppercase tracking-widest mb-1">Edit Profile Details</Text>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Full Name</Text>
                                        <TextInput value={editForm.full_name} onChangeText={(t) => setEditForm({...editForm, full_name: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Username</Text>
                                        <TextInput value={editForm.username} onChangeText={(t) => setEditForm({...editForm, username: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-[1.5]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Phone</Text>
                                        <TextInput value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="phone-pad" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Custom ID</Text>
                                        <TextInput value={editForm.custom_id} onChangeText={(t) => setEditForm({...editForm, custom_id: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-[2]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Address</Text>
                                        <TextInput value={editForm.address} onChangeText={(t) => setEditForm({...editForm, address: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">State</Text>
                                        <TextInput value={editForm.state} onChangeText={(t) => setEditForm({...editForm, state: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Account Number</Text>
                                        <TextInput value={editForm.account_number} onChangeText={(t) => setEditForm({...editForm, account_number: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">KYC Tier</Text>
                                        <TextInput value={editForm.kyc_tier} onChangeText={(t) => setEditForm({...editForm, kyc_tier: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">BVN</Text>
                                        <TextInput value={editForm.bvn} onChangeText={(t) => setEditForm({...editForm, bvn: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">NIN</Text>
                                        <TextInput value={editForm.nin} onChangeText={(t) => setEditForm({...editForm, nin: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Gender</Text>
                                        <TextInput value={editForm.gender} onChangeText={(t) => setEditForm({...editForm, gender: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">DOB (YYYY-MM-DD)</Text>
                                        <TextInput value={editForm.dob} onChangeText={(t) => setEditForm({...editForm, dob: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-[1.5]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Next of Kin Name</Text>
                                        <TextInput value={editForm.next_of_kin_name} onChangeText={(t) => setEditForm({...editForm, next_of_kin_name: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Next of Kin Phone</Text>
                                        <TextInput value={editForm.next_of_kin_phone} onChangeText={(t) => setEditForm({...editForm, next_of_kin_phone: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="phone-pad" />
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => { setPendingAction({ type: 'edit_profile' }); setShowSecurity(true); }} className="bg-[#0A1128] py-3 rounded-xl items-center shadow-sm mt-2">
                                    <Text className="text-[#D4AF37] font-bold text-xs uppercase tracking-widest">Save Changes</Text>
                                </TouchableOpacity>
                            </View>`;

const startIdx = content.indexOf(oldUIStart);
const endIdx = content.indexOf(oldUIEnd) + oldUIEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + newUI + content.slice(endIdx);
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Successfully expanded edit form.");
} else {
    console.error("Could not find UI block.");
}
