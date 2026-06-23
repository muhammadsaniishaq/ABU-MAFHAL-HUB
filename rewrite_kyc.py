import re

with open('app/kyc.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('    return (')
if start_idx == -1:
    print('Could not find return statement')
    exit(1)

new_jsx = '''    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* MODERN HEADER */}
            <View className="shadow-2xl shadow-indigo-500/20 z-10">
                <LinearGradient 
                    colors={['#0F172A', '#1E293B']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="pt-16 pb-12 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between mb-8">
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/10 backdrop-blur-md">
                            <Ionicons name="chevron-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View className="bg-white/5 px-5 py-2 rounded-full border border-white/10 backdrop-blur-md flex-row items-center gap-2">
                            <View className={`w-2 h-2 rounded-full ${tier >= 4 ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">{tier >= 4 ? 'Verified' : 'Unverified'}</Text>
                        </View>
                    </View>
                    
                    <View>
                        <Text className="text-white text-4xl font-black mb-2 tracking-tight">KYC Center</Text>
                        <Text className="text-slate-400 text-sm font-medium leading-6 max-w-[90%]">
                            Complete all tiers to unlock maximum limits and your official certificate.
                        </Text>
                    </View>
                </LinearGradient>
            </View>
            
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView 
                    className="flex-1 px-6 -mt-8 z-20" 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 150 }}
                >
                    
                    {/* PROGRESS CARD */}
                    <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-8 mt-2">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Current Tier</Text>
                                <Text className="text-slate-900 font-black text-2xl">Level {tier}</Text>
                            </View>
                            {/* Modern Circular Progress */}
                            <View className="w-16 h-16 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100 shadow-sm">
                                <Text className="font-black text-indigo-600 text-xl">{tier * 25}%</Text>
                            </View>
                        </View>
                        
                        {/* Stepper Dots */}
                        <View className="flex-row justify-between items-center px-2">
                            {[1, 2, 3, 4].map((t, index) => (
                                <View key={t} className="flex-row items-center flex-1 justify-center">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center border-2 ${tier >= t ? 'bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/30' : tier + 1 === t ? 'bg-white border-indigo-500' : 'bg-slate-50 border-slate-200'}`}>
                                        {tier >= t ? (
                                            <Ionicons name="checkmark" size={16} color="white" />
                                        ) : (
                                            <Text className={`font-bold ${tier + 1 === t ? 'text-indigo-600' : 'text-slate-400'}`}>{t}</Text>
                                        )}
                                    </View>
                                    {index < 3 && (
                                        <View className={`flex-1 h-1 mx-1 rounded-full ${tier > t ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                                    )}
                                </View>
                            ))}
                        </View>
                        
                        <View className="flex-row justify-between mt-3 px-1">
                            <Text className={`text-[9px] font-bold uppercase ${tier >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>Personal</Text>
                            <Text className={`text-[9px] font-bold uppercase ${tier >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>Identity</Text>
                            <Text className={`text-[9px] font-bold uppercase ${tier >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>Address</Text>
                            <Text className={`text-[9px] font-bold uppercase ${tier >= 4 ? 'text-indigo-600' : 'text-slate-400'}`}>Liveness</Text>
                        </View>
                    </View>
    
                    {pendingRequest ? (
                        <View className="bg-amber-50 p-8 rounded-[32px] border border-amber-100 items-center mb-8 shadow-sm">
                            <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-md shadow-amber-200/50 mb-6">
                                <ActivityIndicator size="large" color="#F59E0B" />
                            </View>
                            <Text className="text-amber-900 font-black text-2xl mb-3 text-center">Review In Progress</Text>
                            <Text className="text-amber-700/80 text-center leading-6 font-medium text-base">
                                We are carefully reviewing your <Text className="font-bold text-amber-900">{pendingRequest.document_type?.replace('_', ' ').toUpperCase()}</Text>.{'\n'}
                                This usually takes less than 24 hours.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            
                        {/* TIER 1: PERSONAL INFO */}
                        {tier === 0 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="person" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">Personal Details</Text>
                                </View>
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 gap-y-5">
                                    
                                    <View className="relative">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Full Legal Name</Text>
                                        <TextInput value={fullName} onChangeText={setFullName} placeholder="e.g. John Doe" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-semibold text-slate-800"  />
                                    </View>
                                    <View className="relative">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Date of Birth</Text>
                                        <TextInput value={dob} onChangeText={setDob} placeholder="DD/MM/YYYY" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-semibold text-slate-800" />
                                    </View>
                                    <View className="flex-row gap-4">
                                        <View className="flex-1 relative">
                                            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Gender</Text>
                                            <TextInput value={gender} onChangeText={setGender} placeholder="M/F" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-semibold text-slate-800" />
                                        </View>
                                        <View className="flex-1 relative">
                                            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">State</Text>
                                            <TextInput value={stateRes} onChangeText={setStateRes} placeholder="e.g. Kano" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-semibold text-slate-800" />
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={submitTier1} disabled={verifying} className="mt-4 active:scale-95 transition-transform">
                                        <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl items-center justify-center shadow-lg shadow-slate-900/20">
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save & Continue</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 2: IDENTITY */}
                        {tier === 1 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="card" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">Identity Verification</Text>
                                </View>
                                
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    
                                    {/* INSTANT VERIFICATION BADGE */}
                                    <View className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200/50 mb-6 flex-row items-center gap-4">
                                        <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
                                            <Ionicons name="flash" size={24} color="#059669" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-emerald-900 font-black text-base tracking-tight mb-0.5">Instant Approval</Text>
                                            <Text className="text-emerald-700/80 text-xs font-bold leading-4">BVN & NIN are verified instantly to unlock Virtual Accounts.</Text>
                                        </View>
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 -mx-2 px-2" contentContainerStyle={{ paddingRight: 20 }}>
                                        {(['nin', 'bvn', 'voters_card', 'drivers_license'] as ValidDocType[]).map((type) => (
                                            <TouchableOpacity 
                                                key={type}
                                                onPress={() => setIdType(type)}
                                                className={`mr-3 px-5 py-3.5 rounded-2xl border flex-row items-center gap-2 ${idType === type ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200'}`}
                                            >
                                                <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${idType === type ? 'border-indigo-500' : 'border-slate-300'}`}>
                                                    {idType === type && <View className="w-2 h-2 bg-indigo-500 rounded-full" />}
                                                </View>
                                                <Text className={`font-bold capitalize text-sm ${idType === type ? 'text-indigo-700' : 'text-slate-500'}`}>
                                                    {type.replace('_', ' ')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    
                                    <View className="mb-8">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Enter {idType.replace('_', ' ')} Number</Text>
                                        <View className={`flex-row items-center bg-slate-50 border-2 rounded-2xl px-5 h-16 transition-colors ${idAvailable === false ? 'border-red-400 bg-red-50' : idAvailable === true ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 focus:border-indigo-500'}`}>
                                            <Ionicons name="keypad" size={20} color="#94A3B8" className="mr-3" />
                                            <TextInput 
                                                value={idNumber} 
                                                onChangeText={setIdNumber} 
                                                placeholder="00000000000" 
                                                className="flex-1 font-black text-xl tracking-[0.2em] text-slate-800" 
                                                keyboardType="numeric"
                                            />
                                            {checkingId ? (
                                                <ActivityIndicator size="small" color="#4F46E5" />
                                            ) : idAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                                            ) : idAvailable === false ? (
                                                <Ionicons name="close-circle" size={24} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {idAvailable === false && (
                                            <Text className="text-red-500 text-xs font-bold text-center mt-3 bg-red-50 py-2 rounded-lg">
                                                This ID number is already linked to another account.
                                            </Text>
                                        )}
                                    </View>

                                    <TouchableOpacity onPress={submitTier2} disabled={verifying} className="active:scale-95 transition-transform">
                                        <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-slate-900/20">
                                            {verifying ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Text className="text-white font-bold text-lg">Verify ID Now</Text>
                                                    <Ionicons name="arrow-forward" size={20} color="white" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 3: ADDRESS */}
                        {tier === 2 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="home" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">Address Proof</Text>
                                </View>
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <Text className="text-slate-500 font-medium text-sm mb-6 leading-6">Please upload a clear copy of a recent utility bill or bank statement showing your address.</Text>
                                    
                                    <View className="flex-row gap-4 mb-6">
                                        <TouchableOpacity onPress={() => setAddressDocType('utility_bill')} className={`flex-1 py-4 items-center justify-center rounded-2xl border-2 flex-row gap-2 ${addressDocType === 'utility_bill' ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-100'}`}>
                                            <Ionicons name="flash" size={16} color={addressDocType === 'utility_bill' ? '#4F46E5' : '#94A3B8'} />
                                            <Text className={`font-bold text-xs uppercase tracking-wide ${addressDocType === 'utility_bill' ? 'text-indigo-700' : 'text-slate-500'}`}>Utility Bill</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setAddressDocType('bank_statement')} className={`flex-1 py-4 items-center justify-center rounded-2xl border-2 flex-row gap-2 ${addressDocType === 'bank_statement' ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-100'}`}>
                                            <Ionicons name="business" size={16} color={addressDocType === 'bank_statement' ? '#4F46E5' : '#94A3B8'} />
                                            <Text className={`font-bold text-xs uppercase tracking-wide ${addressDocType === 'bank_statement' ? 'text-indigo-700' : 'text-slate-500'}`}>Bank Stmt</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View className="relative mb-6">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Full Residential Address</Text>
                                        <TextInput 
                                            multiline 
                                            value={address} 
                                            onChangeText={setAddress} 
                                            placeholder="e.g. 123 Main Street..." 
                                            className="bg-slate-50 p-5 rounded-2xl border border-slate-200 font-semibold text-slate-800 min-h-[100px]" 
                                            textAlignVertical="top"
                                        />
                                    </View>

                                    <TouchableOpacity onPress={pickImage} className="mb-8 active:scale-95 transition-transform">
                                        {addressDocUri ? (
                                            <View className="relative">
                                                <Image source={{ uri: addressDocUri }} className="w-full h-48 rounded-2xl border border-slate-200" resizeMode="cover" />
                                                <View className="absolute top-2 right-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md flex-row items-center gap-1">
                                                    <Ionicons name="pencil" size={12} color="white" />
                                                    <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Change</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="w-full h-48 rounded-2xl bg-indigo-50/50 border-2 border-dashed border-indigo-200 items-center justify-center">
                                                <View className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-sm shadow-indigo-100 mb-3">
                                                    <Ionicons name="cloud-upload" size={28} color="#4F46E5" />
                                                </View>
                                                <Text className="text-indigo-900 font-bold text-base">Tap to Upload Document</Text>
                                                <Text className="text-indigo-700/60 font-medium text-xs mt-1">JPEG, PNG or PDF (Max 5MB)</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={submitTier3} disabled={verifying} className="active:scale-95 transition-transform">
                                        <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl items-center justify-center shadow-lg shadow-slate-900/20">
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Submit Address</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 4: LIVENESS */}
                        {tier === 3 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="scan" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">Liveness Check</Text>
                                </View>
                                <View className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-100/50 border border-slate-100 mb-6 items-center relative">
                                    
                                    <Text className="text-slate-500 font-medium text-center mb-8 px-2 leading-6">
                                        We need to verify that you are a real person. Please take a quick selfie in good lighting.
                                    </Text>
                                    
                                    <View className="w-56 h-56 rounded-[100px] bg-slate-50 border-8 border-indigo-50 shadow-inner overflow-hidden mb-8 relative justify-center items-center">
                                    {selfie ? (
                                        <Image source={{ uri: selfie }} className="w-full h-full object-cover" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100">
                                            <Ionicons name="person" size={80} color="#CBD5E1" />
                                        </View>
                                    )}
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            if (!permission?.granted) {
                                                const { granted } = await requestPermission();
                                                if (!granted) return Alert.alert("Camera Permission", "We need camera permission to verify your identity.");
                                            }
                                            setShowCamera(true);
                                        }} 
                                        className="absolute bottom-4 right-12 left-12 h-10 bg-black/60 rounded-full items-center justify-center backdrop-blur-md"
                                    >
                                        <Text className="text-white text-xs font-bold uppercase tracking-widest">{selfie ? 'Retake' : 'Open Camera'}</Text>
                                    </TouchableOpacity>
                                </View>

                                    {selfie && (
                                        <TouchableOpacity 
                                            onPress={() => {
                                                submitTier4();
                                            }} 
                                            disabled={verifying} 
                                            className="w-full active:scale-95 transition-transform"
                                        >
                                            <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-slate-900/20">
                                                {verifying ? (
                                                    <>
                                                        <ActivityIndicator color="white" />
                                                        <Text className="text-white font-semibold">Verifying...</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Text className="text-white font-bold text-lg">Complete Verification</Text>
                                                        <Ionicons name="checkmark-circle" size={20} color="white" />
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* COMPLETED VIEW */}
                {tier >= 4 && (
                    <View className="items-center py-8">
                        <View className="relative mb-8">
                            <View className="absolute inset-0 bg-emerald-400 blur-2xl opacity-40 rounded-full scale-150 animate-pulse" />
                            <View className="w-32 h-32 bg-gradient-to-br from-emerald-100 to-green-50 rounded-full items-center justify-center shadow-xl shadow-emerald-200/50 border-4 border-white relative z-10">
                                <Ionicons name="checkmark-done" size={64} color="#059669" />
                            </View>
                        </View>
                        <Text className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Fully Verified!</Text>
                        <Text className="text-slate-500 font-medium text-center text-base mb-10 px-4 leading-6">
                            Your identity has been fully verified. You now have unlimited access to all features and higher transaction limits.
                        </Text>
                        
                        {/* CERTIFICATE PREVIEW CARD */}
                        <View className="w-full bg-slate-900 p-6 rounded-[32px] mb-8 shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                            <View className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 blur-3xl rounded-full" />
                            <View className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full" />
                            
                            <View className="flex-row items-center gap-4 mb-6 relative z-10">
                                <View className="w-12 h-12 bg-amber-500/20 rounded-full items-center justify-center border border-amber-500/30">
                                    <Ionicons name="ribbon" size={24} color="#F59E0B" />
                                </View>
                                <View>
                                    <Text className="text-white font-black text-lg">Official Certificate</Text>
                                    <Text className="text-slate-400 font-medium text-xs">Tier 4 Verified Status</Text>
                                </View>
                            </View>
                            
                            <TouchableOpacity 
                                onPress={generateCertificate}
                                className="w-full active:scale-95 transition-transform relative z-10"
                            >
                                <LinearGradient
                                    colors={['#F59E0B', '#D97706']}
                                    start={{ x: 0, y: 0}}
                                    end={{ x: 1, y: 1}}
                                    className="h-14 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
                                >
                                    <Text className="text-white font-black uppercase tracking-widest text-sm">Download PDF</Text>
                                    <Ionicons name="cloud-download" size={18} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
            </KeyboardAvoidingView>

            {/* CAMERA MODAL */}
            <Modal visible={showCamera} animationType="fade" transparent={true} onRequestClose={() => setShowCamera(false)}>
                 <View className="flex-1 bg-black">
                     <View className="flex-1 relative">
                         <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                         
                         {/* OVERLAY */}
                         <View 
                            className="absolute inset-0 items-center justify-center p-0" 
                            pointerEvents="none"
                         >
                             <View className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                             <View className="w-80 h-[400px] border-4 border-emerald-400/80 rounded-[160px] bg-transparent z-10 relative overflow-hidden shadow-[0_0_50px_rgba(52,211,153,0.3)]">
                                {/* Scanning line animation simulation */}
                                <View className="absolute top-0 w-full h-1 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)] opacity-50" style={{ transform: [{translateY: 200}] }} />
                             </View>
                             <View className="absolute top-24 bg-black/80 px-8 py-4 rounded-full overflow-hidden border border-white/10 backdrop-blur-md z-20">
                                <Text className="text-white font-black text-lg text-center tracking-tight">Position your face inside</Text>
                             </View>
                         </View>

                         {/* CONTROLS */}
                         <View 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-20 pb-12 items-center z-[100]"
                            style={{ elevation: 100, zIndex: 100 }}
                            pointerEvents="box-none"
                         >
                            <View className="flex-row items-center gap-12" pointerEvents="box-none">
                                <TouchableOpacity 
                                    onPress={() => setShowCamera(false)} 
                                    className="w-14 h-14 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md"
                                >
                                    <Ionicons name="close" size={24} color="white" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={takeSelfie} 
                                    className="w-24 h-24 bg-white rounded-full border-[6px] border-emerald-500/50 items-center justify-center shadow-2xl shadow-emerald-500/50 active:scale-95 transition-transform"
                                >
                                    <View className="w-20 h-20 bg-white rounded-full border-2 border-black/10" />
                                </TouchableOpacity>

                                <View className="w-14 h-14" />
                            </View>
                            <Text className="text-white/60 text-xs mt-8 font-bold tracking-[0.2em] uppercase">Ensure good lighting</Text>
                         </View>
                     </View>
                 </View>
            </Modal>
        </View>
    );
}
'''

new_content = content[:start_idx] + new_jsx

with open('app/kyc.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated kyc.tsx layout')
