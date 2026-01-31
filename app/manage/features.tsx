import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

// Type definition for a Feature Flag
interface FeatureFlag {
    feature_key: string;
    label: string;
    is_enabled: boolean;
    maintenance_message: string;
}

export default function ManageFeaturesScreen() {
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .order('label'); // or order by created_at

        if (error) {
            Alert.alert('Error', 'Failed to load feature flags');
            console.error(error);
        } else {
            setFeatures(data || []);
        }
        setLoading(false);
    };

    const toggleFeature = async (feature: FeatureFlag) => {
        setUpdating(feature.feature_key);
        const newValue = !feature.is_enabled;

        const { error } = await supabase
            .from('feature_flags')
            .update({ is_enabled: newValue })
            .eq('feature_key', feature.feature_key);

        if (error) {
            Alert.alert('Error', 'Failed to update feature status');
        } else {
            // Optimistic update
            setFeatures(features.map(f => 
                f.feature_key === feature.feature_key ? { ...f, is_enabled: newValue } : f
            ));
        }
        setUpdating(null);
    };

    const updateMessage = async (feature_key: string, newMessage: string) => {
        const { error } = await supabase
            .from('feature_flags')
            .update({ maintenance_message: newMessage })
            .eq('feature_key', feature_key);

        if (error) Alert.alert('Error', 'Failed to save message');
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Manage Features', headerTintColor: '#0056D2' }} />
            
            <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                    <Text className="text-primary font-bold text-lg mb-1">Feature Control</Text>
                    <Text className="text-gray-600 text-sm">
                        Toggle features ON or OFF. when OFF, users will see the maintenance message and cannot access the feature.
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0056D2" />
                ) : (
                    features.map((feature) => (
                        <View key={feature.feature_key} className="bg-white p-4 rounded-xl mb-4 border border-gray-200 shadow-sm">
                            <View className="flex-row justify-between items-center mb-4">
                                <View>
                                    <Text className="text-lg font-bold text-gray-800">{feature.label}</Text>
                                    <Text className="text-xs text-gray-400">{feature.feature_key}</Text>
                                </View>
                                <View className="items-center">
                                    {updating === feature.feature_key ? (
                                        <ActivityIndicator color="#0056D2" />
                                    ) : (
                                        <Switch
                                            trackColor={{ false: "#767577", true: "#0056D2" }}
                                            thumbColor={"#f4f3f4"}
                                            ios_backgroundColor="#3e3e3e"
                                            onValueChange={() => toggleFeature(feature)}
                                            value={feature.is_enabled}
                                        />
                                    )}
                                    <Text className={`text-xs font-bold mt-1 ${feature.is_enabled ? 'text-green-600' : 'text-red-500'}`}>
                                        {feature.is_enabled ? 'ACTIVE' : 'LOCKED'}
                                    </Text>
                                </View>
                            </View>

                            {!feature.is_enabled && (
                                <View className="bg-red-50 p-3 rounded-lg border border-red-100">
                                    <Text className="text-xs font-bold text-red-700 mb-1">Maintenance Message:</Text>
                                    <TextInput
                                        className="bg-white p-2 text-gray-700 border border-red-200 rounded text-sm"
                                        placeholder="Message shown to users..."
                                        defaultValue={feature.maintenance_message}
                                        onEndEditing={(e) => updateMessage(feature.feature_key, e.nativeEvent.text)}
                                    />
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
