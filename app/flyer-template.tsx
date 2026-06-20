import { View, Text, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
        <LinearGradient 
            colors={['#060d21', '#0d1b3e']} 
            style={s.container}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            {/* Top Logo Branded Section */}
            <View style={s.brandSection}>
                <Image 
                    source={require('../assets/images/logo.png')} 
                    style={s.logo} 
                    resizeMode="contain" 
                />
                <Text style={s.brandName}>MAFHAL HUB</Text>
                <Text style={s.brandTagline}>INSTANT QR PAYMENT</Text>
            </View>

            {/* Main Flyer Card */}
            <View style={s.card}>
                {/* Avatar Badge */}
                <View style={s.avatarWrapper}>
                    <Text style={s.avatarText}>{name ? (name as string)[0].toUpperCase() : 'U'}</Text>
                </View>

                <Text style={s.userName}>{name || 'Valued Customer'}</Text>
                <Text style={s.userEmail}>{email || 'user@mafhalhub.com'}</Text>

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
    );
}

// Import Stack dynamically from expo-router to handle header options
import { Stack } from 'expo-router';

const s = StyleSheet.create({
  container: {
    width: 600,
    height: 800,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 40,
    alignSelf: 'center',
  },
  brandSection: {
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f5a623',
    letterSpacing: 3,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 30,
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    marginBottom: 20,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  scanInstructions: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f5a623',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  footerSection: {
    alignItems: 'center',
  },
  footerSecurity: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1,
  }
});
