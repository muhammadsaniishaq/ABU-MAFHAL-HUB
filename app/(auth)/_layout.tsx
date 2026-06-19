import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="otp" options={{ headerShown: false }} />
            <Stack.Screen name="pin-setup" options={{ headerShown: false }} />
        </Stack>
    );
}
