import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ReceiptTemplateScreen() {
  const { amount, sender, recipient, email, ref, date } = useLocalSearchParams();

  const formattedAmount = amount 
    ? parseFloat(amount as string).toLocaleString('en-US', { minimumFractionDigits: 2 }) 
    : '0.00';

  return (
    <View style={[s.pageWrapper, Platform.OS === 'web' && s.webPageWrapper]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={[s.receiptSheet, Platform.OS === 'web' && s.webReceiptSheet]}>
        
        {/* Top Header Section */}
        <View style={s.topSection}>
          <View style={s.brandDetails}>
            <View style={s.logoContainer}>
              <Image
                source={require('../assets/images/logo.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={s.brandName}>Mafhal Sub</Text>
            <Text style={s.brandAddress}>Plot 124, Gwarinpa Road, Kano, Nigeria</Text>
            <Text style={s.brandContact}>+234 803 123 4567 | hello@abumafhal.com.ng</Text>
          </View>
          
          <View style={s.receiptMetaBox}>
            <View style={s.metaBoxHeader}>
              <Text style={s.metaBoxHeaderText} numberOfLines={1} ellipsizeMode="tail">
                Receipt for #{ref || 'N/A'}
              </Text>
            </View>
            <View style={s.metaBoxBody}>
              <Text style={s.metaBoxDateText} numberOfLines={1} ellipsizeMode="tail">
                Transaction Date: {date || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Recipient Section */}
        <View style={s.recipientSection}>
          <Text style={s.recipientLabel}>RECIPIENT:</Text>
          <Text style={s.recipientName} numberOfLines={2} ellipsizeMode="tail">
            {recipient || 'Mafhal User'}
          </Text>
          <Text style={s.recipientEmail} numberOfLines={1} ellipsizeMode="middle">
            {email || '-'}
          </Text>
          <Text style={s.recipientAddress}>Instant Wallet Transfer Account</Text>
        </View>

        {/* Product / Service Table */}
        <View style={s.tableContainer}>
          {/* Table Header */}
          <View style={s.tableHeader}>
            <View style={{ flex: 3 }}><Text style={s.thText}>PRODUCT / SERVICE</Text></View>
            <View style={{ flex: 4 }}><Text style={s.thText}>DESCRIPTION</Text></View>
            <View style={{ flex: 1.5, alignItems: 'center' }}><Text style={s.thText}>QTY.</Text></View>
            <View style={{ flex: 2.5, alignItems: 'flex-end' }}><Text style={s.thText}>COST</Text></View>
            <View style={{ flex: 2.5, alignItems: 'flex-end' }}><Text style={s.thText}>TOTAL</Text></View>
          </View>
          
          {/* Table Row */}
          <View style={s.tableRow}>
            <View style={{ flex: 3, paddingRight: 4 }}>
              <Text style={[s.tdText, s.fontBold]} numberOfLines={2} ellipsizeMode="tail">
                Wallet Transfer
              </Text>
            </View>
            <View style={{ flex: 4, paddingRight: 4 }}>
              <Text style={[s.tdText, { fontSize: 11, color: '#475569', lineHeight: 15 }]}>
                Instant secure peer-to-peer wallet transfer to {recipient || 'Mafhal User'}. Sender: {sender || 'Mafhal User'}.
              </Text>
            </View>
            <View style={{ flex: 1.5, alignItems: 'center' }}>
              <Text style={s.tdText}>1</Text>
            </View>
            <View style={{ flex: 2.5, alignItems: 'flex-end' }}>
              <Text style={s.tdText} numberOfLines={1} ellipsizeMode="tail">₦{formattedAmount}</Text>
            </View>
            <View style={{ flex: 2.5, alignItems: 'flex-end' }}>
              <Text style={[s.tdText, s.fontBold]} numberOfLines={1} ellipsizeMode="tail">₦{formattedAmount}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={s.bottomSection}>
          <View style={s.thanksContainer}>
            <Text style={s.thanksText}>Thanks for your business!</Text>
          </View>
          
          <View style={s.totalsContainer}>
            <Text style={s.receiptForPaymentTitle}>Receipt for Payment</Text>
            
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal</Text>
              <View style={s.totalsValueContainer}>
                <Text style={s.totalsValue} numberOfLines={1} ellipsizeMode="tail">₦{formattedAmount}</Text>
              </View>
            </View>
            
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Fee (0%)</Text>
              <View style={s.totalsValueContainer}>
                <Text style={s.totalsValue}>₦0.00</Text>
              </View>
            </View>
            
            <View style={s.divider} />
            
            <View style={[s.totalsRow, { marginTop: 6 }]}>
              <Text style={[s.totalsLabel, s.fontBold, { fontSize: 14, color: '#0f172a' }]}>Total</Text>
              <View style={s.totalsValueContainer}>
                <Text style={[s.totalsValue, s.fontBold, { fontSize: 14, color: '#0f172a' }]} numberOfLines={1} ellipsizeMode="tail">
                  ₦{formattedAmount}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer Brand Logo */}
        <View style={s.footerContainer}>
          <Text style={s.poweredByLabel}>POWERED BY</Text>
          <View style={s.footerBrandRow}>
            <Image
              source={require('../assets/images/logo.png')}
              style={s.footerLogo}
              resizeMode="contain"
            />
            <Text style={s.footerBrandName}>MAFHAL SUB</Text>
          </View>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#ffffff', // Pure white background for screenshot rendering
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  webPageWrapper: {
    minHeight: '100vh' as any,
    padding: 20,
  },
  receiptSheet: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 680, // Matches invoice aspect ratio on wider screens
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 36,
    alignSelf: 'center',
  },
  webReceiptSheet: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  brandDetails: {
    flex: 1,
    minWidth: 220,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0d1b3e', // Corporate brand color background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 28,
    height: 28,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0d1b3e',
    marginBottom: 4,
  },
  brandAddress: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  brandContact: {
    fontSize: 11,
    color: '#64748b',
  },
  receiptMetaBox: {
    width: '100%',
    maxWidth: 240,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  metaBoxHeader: {
    backgroundColor: '#7cae12', // Solid lime green matching the Jobber layout
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaBoxHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  metaBoxBody: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metaBoxDateText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  recipientSection: {
    width: '100%',
    marginBottom: 32,
  },
  recipientLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
    marginBottom: 6,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  recipientEmail: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  recipientAddress: {
    fontSize: 12,
    color: '#64748b',
  },
  tableContainer: {
    width: '100%',
    marginBottom: 32,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7cae12', // Solid lime green matching Jobber
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  tdText: {
    fontSize: 12,
    color: '#0f172a',
    flexWrap: 'wrap',
  },
  fontBold: {
    fontWeight: '700',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 48,
    flexWrap: 'wrap',
    gap: 20,
  },
  thanksContainer: {
    flex: 1,
    minWidth: 200,
  },
  thanksText: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
  totalsContainer: {
    width: '100%',
    maxWidth: 240,
  },
  receiptForPaymentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  totalsLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  totalsValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  totalsValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 24,
  },
  poweredByLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLogo: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  footerBrandName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.5,
  },
});
