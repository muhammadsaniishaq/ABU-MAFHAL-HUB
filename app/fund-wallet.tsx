import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function FundWalletRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/(app)/wallet');
    }, []);
    return null;
}
