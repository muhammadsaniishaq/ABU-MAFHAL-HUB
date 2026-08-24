import { Platform } from 'react-native';

/**
 * Global Google Ads Conversion Tracker for Abu Mafhal Sub
 * Tag ID: AW-18403539201
 * Purchase Event: AW-18403539201/s-tACJG2ruYcEIHyvsdE
 */
export const trackGooglePurchaseConversion = (
  transactionId?: string | number,
  value?: number,
  currency: string = 'NGN'
) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', 'conversion', {
        send_to: 'AW-18403539201/s-tACJG2ruYcEIHyvsdE',
        transaction_id: transactionId ? String(transactionId) : '',
        value: value || 0,
        currency: currency,
      });
    } catch (e) {
      console.log('Google Ads conversion track error:', e);
    }
  }
};

export const trackGoogleEvent = (eventName: string, params: Record<string, any> = {}) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', eventName, params);
    } catch (e) {}
  }
};
