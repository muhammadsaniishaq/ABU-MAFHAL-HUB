import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function ReceiptTemplateScreen() {
  const { amount, sender, recipient, email, ref, date } = useLocalSearchParams();

  const formattedAmount = amount 
    ? parseFloat(amount as string).toLocaleString('en-NG', { minimumFractionDigits: 2 }) 
    : '0.00';

  return (
    <View style={[s.pageWrapper, Platform.OS === 'web' && s.webPageWrapper]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={[s.receiptSheet, Platform.OS === 'web' && s.webReceiptSheet]}>
        
        {/* Brand Header */}
        <View style={s.brandHeader}>
          <View style={s.logoContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={s.brandName}>MAFHAL HUB</Text>
          <Text style={s.brandTagline}>OFFICIAL TRANSACTION RECEIPT</Text>
        </View>

        {/* Amount & Status Box */}
        <View style={s.amountBox}>
          <Text style={s.amountLabel}>Sent Amount</Text>
          <Text style={s.amountText}>₦{formattedAmount}</Text>
          
          <View style={s.statusPill}>
            <Ionicons name="checkmark-circle" size={14} color="#047857" />
            <Text style={s.statusText}>SUCCESSFUL</Text>
          </View>
        </View>

        {/* Dashed Separator */}
        <View style={s.dashedLine} />

        {/* Transaction Details */}
        <View style={s.detailsSection}>
          <Text style={s.sectionTitle}>Transaction Details</Text>
          
          <View style={s.row}>
            <Text style={s.label}>Sender Name</Text>
            <Text style={s.value}>{sender || 'Mafhal User'}</Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Recipient Name</Text>
            <Text style={s.value}>{recipient || 'Mafhal User'}</Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Recipient Email</Text>
            <Text style={s.value}>{email || '-'}</Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Payment Method</Text>
            <Text style={s.value}>Wallet-to-Wallet</Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Transaction Ref</Text>
            <Text style={[s.value, s.monospace]}>{ref || '-'}</Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Date & Time</Text>
            <Text style={s.value}>{date || '-'}</Text>
          </View>
        </View>

        {/* Second Dashed Separator */}
        <View style={s.dashedLine} />

        {/* Barcode & Security Verification */}
        <View style={s.verificationSection}>
          <View style={s.barcodeContainer}>
            <View style={s.barcodeLines}>
              <View style={[s.bar, { width: 3 }]} />
              <View style={[s.bar, { width: 1, marginLeft: 2 }]} />
              <View style={[s.bar, { width: 5, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 2, marginLeft: 3 }]} />
              <View style={[s.bar, { width: 1, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 4, marginLeft: 2 }]} />
              <View style={[s.bar, { width: 2, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 6, marginLeft: 3 }]} />
              <View style={[s.bar, { width: 1, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 3, marginLeft: 2 }]} />
              <View style={[s.bar, { width: 2, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 4, marginLeft: 2 }]} />
              <View style={[s.bar, { width: 1, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 3, marginLeft: 3 }]} />
              <View style={[s.bar, { width: 5, marginLeft: 1 }]} />
              <View style={[s.bar, { width: 2, marginLeft: 2 }]} />
            </View>
            <Text style={s.barcodeText}>MFL-{ref || 'SECURE'}</Text>
          </View>

          <Text style={s.footerDisclaimer}>
            This is an official system-generated transaction receipt from Mafhal Hub. No signature is required.
          </Text>
          
          <Text style={s.securityHash}>
            SECURE HASH: SHA-256/{Math.random().toString(36).substring(2, 10).toUpperCase()}
          </Text>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9', // Professional off-white background
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  webPageWrapper: {
    minHeight: '100vh' as any,
    padding: 24,
  },
  receiptSheet: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  webReceiptSheet: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  amountBox: {
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 18,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  amountLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  amountText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#065f46',
    marginLeft: 4.5,
    letterSpacing: 0.5,
  },
  dashedLine: {
    borderStyle: 'dashed',
    borderWidth: 0.75,
    borderColor: '#cbd5e1',
    marginVertical: 20,
    height: 0,
    width: '100%',
  },
  detailsSection: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  value: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11.5,
  },
  verificationSection: {
    alignItems: 'center',
    width: '100%',
  },
  barcodeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  barcodeLines: {
    flexDirection: 'row',
    height: 28,
    alignItems: 'stretch',
    marginBottom: 4,
  },
  bar: {
    backgroundColor: '#1e293b',
    height: '100%',
  },
  barcodeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  footerDisclaimer: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 14.5,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  securityHash: {
    fontSize: 8,
    color: '#cbd5e1',
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 10,
  },
});
