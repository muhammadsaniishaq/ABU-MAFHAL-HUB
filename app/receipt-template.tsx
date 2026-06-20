import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function ReceiptTemplateScreen() {
  const { amount, sender, recipient, email, ref, date } = useLocalSearchParams();

  const formattedAmount = amount ? parseFloat(amount as string).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00';

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
        {/* Brand Header */}
        <View style={s.brandSection}>
          <Image
            source={require('../assets/icon.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.brandName}>MAFHAL HUB</Text>
          <Text style={s.brandTagline}>TRANSACTION RECEIPT</Text>
        </View>

        {/* Receipt Card */}
        <View style={s.card}>
          {/* Status Badge */}
          <View style={s.statusBadge}>
            <Ionicons name="checkmark-circle" size={48} color="#107C10" />
            <Text style={s.statusText}>SUCCESSFUL</Text>
          </View>

          {/* Amount */}
          <Text style={s.amountLabel}>Sent Amount</Text>
          <Text style={s.amountText}>₦{formattedAmount}</Text>

          {/* Divider */}
          <View style={s.divider} />

          {/* Details Table */}
          <View style={s.detailsContainer}>
            <View style={s.row}>
              <Text style={s.label}>Sender</Text>
              <Text style={s.value}>{sender || 'Mafhal User'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Recipient</Text>
              <Text style={s.value}>{recipient || 'Mafhal Merchant'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Recipient Email</Text>
              <Text style={s.value}>{email || '-'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Reference</Text>
              <Text style={s.value}>{ref || '-'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Date & Time</Text>
              <Text style={s.value}>{date || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Footer Section */}
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
    width: 44,
    height: 44,
    marginBottom: 6,
  },
  brandName: {
    fontSize: 20,
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
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    alignItems: 'center',
  },
  statusBadge: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#107C10',
    marginTop: 4,
    letterSpacing: 1,
  },
  amountLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  amountText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  detailsContainer: {
    width: '100%',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  value: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '800',
  },
  footerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerSecurity: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.25)',
    letterSpacing: 1,
  }
});
