import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function FlyerTemplateScreen() {
    const { name, email, userId } = useLocalSearchParams();

    // Construct the QR payload matching the scanner's expected format
    const payload = JSON.stringify({
        type: 'transfer',
        userId: userId,
        name: name,
        email: email
    });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}&color=0d1b3e`;

    return (
        <View style={[s.pageWrapper, Platform.OS === 'web' && s.webPageWrapper]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            <LinearGradient 
                colors={['#060d21', '#0d1b3e']} 
                style={[s.container, Platform.OS === 'web' && s.webContainer]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            >
                {/* Top Logo Branded Section */}
                <View style={s.brandSection}>
                    <Image 
                        source={require('../assets/images/logo.png')} 
                        style={s.logo} 
                        resizeMode="contain" 
                    />
                    <Text style={s.brandName}>MAFHAL SUB</Text>
                    <Text style={s.brandTagline}>INSTANT QR PAYMENT</Text>
                </View>

                {/* Main Flyer Card */}
                <View style={s.card}>
                    {/* Avatar Badge */}
                    <View style={s.avatarWrapper}>
                        <Text style={s.avatarText}>{name ? (name as string)[0].toUpperCase() : 'U'}</Text>
                    </View>

                    <Text style={s.userName} numberOfLines={1}>{name || 'Valued Customer'}</Text>
                    <Text style={s.userEmail} numberOfLines={1}>{email || 'user@mafhalsub.com'}</Text>

                    {/* QR Code */}
                    <View style={s.qrWrapper}>
                        <Image 
                            source={{ uri: qrUrl }} 
                            style={s.qrImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Scan Frame Accent decoration */}
                    <Text style={s.scanInstructions}>Scan this code to pay instantly</Text>
                </View>

                {/* Bottom Footer Section */}
                <View style={s.footerSection}>
                    <Text style={s.footerSecurity}>🔒 SECURED BY SUPABASE & PAYSTACK</Text>
                </View>
            </LinearGradient>
        </View>
    );
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#060d21',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  webPageWrapper: {
    minHeight: '100vh' as any,
    padding: 16,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 380,
    maxHeight: 620,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(6, 13, 33, 0.95)',
  },
  webContainer: {
    flex: undefined as any,
    maxHeight: undefined as any,
    minHeight: 520,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 6,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f5a623',
    letterSpacing: 3,
    marginTop: 2,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 24,
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  scanInstructions: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f5a623',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  footerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerSecurity: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1,
  }
});
