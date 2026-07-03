import { View, Text, Image, StyleSheet, Platform, Dimensions } from 'react-native';
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

    // Dark colored QR on white background for the center
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}&color=0d1b3e`;

    return (
        <View style={[s.pageWrapper, Platform.OS === 'web' && s.webPageWrapper]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            <View style={[s.container, Platform.OS === 'web' && s.webContainer]}>
                {/* Base Background Gradient (Teal/Blue vibe) */}
                <LinearGradient 
                    colors={['#294a6b', '#1a334f']} 
                    style={StyleSheet.absoluteFillObject}
                />

                {/* --- Decorative Shapes (Hexagon-like and Angles) --- */}
                
                {/* Large white diagonal sweep at the top */}
                <View style={s.topWhiteSweep} />

                {/* Floating Hexagons */}
                <View style={[s.hexagon, s.hexTopRight]} />
                <View style={[s.hexagon, s.hexBottomLeft]} />
                <View style={[s.hexagon, s.hexBottomRight]} />

                {/* Dark shape at the bottom */}
                <View style={s.bottomDarkSweep} />

                {/* Little accent marks */}
                <Text style={[s.accent, { top: 120, right: '20%' }]}>+</Text>
                <Text style={[s.accent, { bottom: 200, right: '15%' }]}>+</Text>
                <Text style={[s.accent, { top: 180, left: '15%' }]}>*</Text>
                <Text style={[s.accent, { bottom: 250, left: '10%' }]}>o</Text>

                {/* --- Content Area --- */}
                
                {/* Header (Top) */}
                <View style={s.header}>
                    <Text style={s.brandName}>MAFHAL SUB</Text>
                    <Text style={s.brandTagline}>INSTANT QR PAYMENT</Text>
                </View>

                {/* Main Dark Center Container */}
                <View style={s.centerBlock}>
                    <View style={s.centerBlockInner}>
                        
                        <Text style={s.userName} numberOfLines={1}>{name || 'Valued Customer'}</Text>
                        <Text style={s.userEmail} numberOfLines={1}>{email || 'user@mafhalsub.com'}</Text>

                        {/* QR Code Container */}
                        <View style={s.qrWrapper}>
                            <Image 
                                source={{ uri: qrUrl }} 
                                style={s.qrImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={s.scanText}>SCAN IT</Text>
                        <Text style={s.joinText}>& PAY INSTANTLY</Text>

                    </View>
                </View>

                {/* Footer (Bottom) */}
                <View style={s.footer}>
                    <Text style={s.footerText}>Secured by Mafhal Sub System</Text>
                    <Text style={s.footerUrl}>www.abumafhal.com.ng</Text>
                </View>

            </View>
        </View>
    );
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#0d1b3e',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  webPageWrapper: {
    minHeight: '100vh' as any,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    maxHeight: 800,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#294a6b',
  },
  webContainer: {
    flex: undefined as any,
    maxHeight: undefined as any,
    minHeight: 800, // Matches thum.io 600x800 crop
    width: 600,
  },
  
  // --- Decorations ---
  topWhiteSweep: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 800,
    height: 400,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-15deg' }],
  },
  bottomDarkSweep: {
    position: 'absolute',
    bottom: -100,
    right: -50,
    width: 600,
    height: 250,
    backgroundColor: '#0a1931',
    transform: [{ rotate: '10deg' }],
  },
  hexagon: {
    position: 'absolute',
    backgroundColor: '#437fa8',
    borderRadius: 20,
    transform: [{ rotate: '30deg' }],
    opacity: 0.9,
  },
  hexTopRight: {
    top: 250,
    right: -40,
    width: 140,
    height: 140,
  },
  hexBottomLeft: {
    bottom: 220,
    left: -50,
    width: 160,
    height: 160,
    backgroundColor: '#386c94',
  },
  hexBottomRight: {
    bottom: 50,
    right: 20,
    width: 80,
    height: 80,
    backgroundColor: '#1d3856',
    borderRadius: 12,
  },
  accent: {
    position: 'absolute',
    color: '#ffffff',
    fontSize: 24,
    opacity: 0.6,
    fontWeight: '300',
  },

  // --- Content Layout ---
  header: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0d1b3e',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#386c94',
    letterSpacing: 3,
    marginTop: 4,
  },
  
  // Center Block
  centerBlock: {
    position: 'absolute',
    top: '25%',
    left: '12%',
    right: '12%',
    backgroundColor: '#0d1b3e',
    borderRadius: 60,
    // Hexagon-ish clipping
    borderTopLeftRadius: 80,
    borderBottomRightRadius: 80,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
    zIndex: 10,
  },
  centerBlockInner: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 52,
    borderTopLeftRadius: 72,
    borderBottomRightRadius: 72,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: '#437fa8',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  scanText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  joinText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    letterSpacing: 1,
  },
  footerUrl: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  }
});
