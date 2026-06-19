import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function DebugEducation() {
    const router = useRouter();

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Debug Education Screen</Text>
            <TouchableOpacity onPress={() => router.back()}>
                <Text>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
}
