import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet, Modal, Platform, Linking, Alert } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PaystackPaymentProps {
    visible: boolean;
    amount: number; // in Naira
    email: string;
    userId?: string;
    publicKey?: string;
    authorizationUrl?: string;
    reference?: string;
    onSuccess: (response: any) => void;
    onCancel: () => void;
    onClose: () => void;
}

export default function PaystackPayment({
    visible,
    amount,
    email,
    userId,
    publicKey,
    authorizationUrl,
    reference,
    onSuccess,
    onCancel,
    onClose
}: PaystackPaymentProps) {
    const webViewRef = useRef<WebView>(null);
    const [hasHandledCallback, setHasHandledCallback] = useState(false);

    // Amount in kobo for fallback inline popup
    const amountKobo = Math.round(amount * 100);
    const cleanUserId = (userId || '').replace(/[^a-zA-Z0-9]/g, '');
    const activeRef = reference || `PAY_${cleanUserId || 'GUEST'}_${Date.now()}`;

    // Reset handled state on modal open
    useEffect(() => {
        if (visible) {
            setHasHandledCallback(false);
        }
    }, [visible]);

    const handleSuccessCallback = (resRef: string) => {
        if (hasHandledCallback) return;
        setHasHandledCallback(true);
        onSuccess({
            reference: resRef || activeRef,
            status: 'success',
            trxref: resRef || activeRef
        });
        onClose();
    };

    const handleCancelCallback = () => {
        if (hasHandledCallback) return;
        setHasHandledCallback(true);
        onCancel();
        onClose();
    };

    const handleConfirmClose = () => {
        Alert.alert(
            "Cancel Payment?",
            "Are you sure you want to cancel this payment? If you were already debited, your reference can still be verified.",
            [
                { text: "Stay Here", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: () => {
                        handleCancelCallback();
                    }
                }
            ]
        );
    };

    // Fallback HTML if authorizationUrl is not provided but publicKey is available
    const paystackInlineHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            body { background-color: #ffffff; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            #status { margin-bottom: 20px; font-size: 15px; color: #475569; text-align: center; padding: 20px; font-weight: 500; }
            .loader { border: 4px solid #E2E8F0; border-top: 4px solid #0056D2; border-radius: 50%; width: 44px; height: 44px; animation: spin 0.9s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .error { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
            <div id="loader" class="loader"></div>
            <div id="status">Connecting to Paystack Secure Gateway...</div>
            
            <script>
                function updateStatus(msg, isError) {
                    var el = document.getElementById('status');
                    el.innerHTML = msg;
                    if (isError) {
                        el.className = 'error';
                        document.getElementById('loader').style.display = 'none';
                    }
                }

                function payWithPaystack() {
                    try {
                        updateStatus("Opening Secure Card Gateway...", false);
                        var handler = PaystackPop.setup({
                            key: '${publicKey || ""}',
                            email: '${email}',
                            amount: ${amountKobo},
                            currency: 'NGN',
                            ref: '${activeRef}',
                            metadata: {
                                user_id: '${userId || ""}',
                                custom_fields: [
                                    {
                                        display_name: "User ID",
                                        variable_name: "user_id",
                                        value: "${userId || ""}"
                                    }
                                ]
                            },
                            callback: function(response) {
                                var resPayload = Object.assign({}, response, {
                                    reference: response.reference || response.trxref || '${activeRef}',
                                    user_id: '${userId || ""}'
                                });
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'success', data: resPayload}));
                                } else {
                                    window.parent.postMessage(JSON.stringify({type: 'success', data: resPayload}), '*');
                                }
                            },
                            onClose: function() {
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'cancel'}));
                                } else {
                                    window.parent.postMessage(JSON.stringify({type: 'cancel'}), '*');
                                }
                            }
                        });
                        handler.openIframe();
                    } catch (e) {
                         updateStatus("Error: " + e.message, true);
                    }
                }
            </script>
            <script src="https://js.paystack.co/v1/inline.js" onload="payWithPaystack()" onerror="updateStatus('Failed to load Paystack script. Please check your internet connection.', true)"></script>
        </body>
      </html>
    `;

    // Intercept navigation for both Standard Checkout and Inline fallback
    const processNavigationUrl = (url: string): boolean => {
        if (!url) return true;

        const lowerUrl = url.toLowerCase();

        // 1. Check for Paystack redirect to close / success callback
        if (
            lowerUrl.includes('standard.paystack.co/close') ||
            lowerUrl.includes('abumafhal.com.ng') ||
            lowerUrl.includes('trxref=') ||
            lowerUrl.includes('reference=')
        ) {
            let extractedRef = activeRef;
            try {
                const parsed = new URL(url);
                const qRef = parsed.searchParams.get('reference') || parsed.searchParams.get('trxref');
                if (qRef) extractedRef = qRef;
            } catch (_) {
                const match = url.match(/[?&](reference|trxref)=([^&]+)/);
                if (match && match[2]) {
                    extractedRef = decodeURIComponent(match[2]);
                }
            }
            handleSuccessCallback(extractedRef);
            return false;
        }

        // 2. Check for Paystack cancel redirect
        if (lowerUrl.includes('/cancel') || lowerUrl.includes('status=cancelled')) {
            handleCancelCallback();
            return false;
        }

        // 3. Handle external schemes (intent://, tel:, whatsapp:, bank app deep links)
        // This is CRITICAL on Android to prevent ERR_UNKNOWN_URL_SCHEME and crash
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            Linking.canOpenURL(url).then(supported => {
                if (supported) {
                    Linking.openURL(url).catch(() => {});
                }
            }).catch(() => {});
            return false; // Prevent WebView from trying to load unknown scheme
        }

        return true;
    };

    // Web message handler
    useEffect(() => {
        if (Platform.OS === 'web' && visible) {
            const handleWebMessage = (event: MessageEvent) => {
                try {
                    if (typeof event.data === 'string') {
                        const data = JSON.parse(event.data);
                        if (data.type === 'success') {
                            handleSuccessCallback(data.data?.reference || activeRef);
                        } else if (data.type === 'cancel') {
                            handleCancelCallback();
                        }
                    }
                } catch (_) {}
            };
            window.addEventListener('message', handleWebMessage);
            return () => window.removeEventListener('message', handleWebMessage);
        }
    }, [visible, activeRef]);

    const handleWebviewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'success') {
                handleSuccessCallback(data.data?.reference || activeRef);
            } else if (data.type === 'cancel') {
                handleCancelCallback();
            }
        } catch (_) {}
    };

    if (!visible) return null;

    // Use standard authorization URL if provided, otherwise fallback to inline html
    const webViewSource = authorizationUrl
        ? { uri: authorizationUrl }
        : { html: paystackInlineHtml, baseUrl: 'https://standard.paystack.co' };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleConfirmClose}>
            <SafeAreaView style={styles.container}>
                {/* Modern Branded Secure Header */}
                <View style={styles.header}>
                    <View style={styles.headerTitleContainer}>
                        <View style={styles.sslBadge}>
                            <Ionicons name="lock-closed" size={13} color="#059669" />
                            <Text style={styles.sslText}>256-Bit SSL</Text>
                        </View>
                        <Text style={styles.headerTitle}>Paystack Checkout</Text>
                        <Text style={styles.headerSubtitle}>₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleConfirmClose}
                        style={styles.closeBtn}
                        accessibilityLabel="Cancel Payment"
                    >
                        <Ionicons name="close" size={22} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {Platform.OS === 'web' ? (
                    <iframe
                        src={authorizationUrl || undefined}
                        srcDoc={!authorizationUrl ? paystackInlineHtml : undefined}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation"
                    />
                ) : (
                    <WebView
                        ref={webViewRef}
                        source={webViewSource}
                        originWhitelist={['*']}
                        setSupportMultipleWindows={false}
                        javaScriptCanOpenWindowsAutomatically={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        mixedContentMode="always"
                        allowsInlineMediaPlayback={true}
                        scalesPageToFit={true}
                        onMessage={handleWebviewMessage}
                        onShouldStartLoadWithRequest={(request) => processNavigationUrl(request.url)}
                        onNavigationStateChange={(navState: WebViewNavigation) => processNavigationUrl(navState.url)}
                        onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.warn('[PaystackPayment] WebView handled warning:', nativeEvent.description || nativeEvent);
                        }}
                        onHttpError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.warn('[PaystackPayment] HTTP handled warning:', nativeEvent.statusCode);
                        }}
                        renderLoading={() => (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#0056D2" />
                                <Text style={styles.loadingText}>Connecting to Paystack Secure Gateway...</Text>
                                <Text style={styles.loadingSubtext}>Please do not close or press back</Text>
                            </View>
                        )}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        zIndex: 10
    },
    headerTitleContainer: {
        flex: 1
    },
    sslBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2
    },
    sslText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0056D2',
        marginTop: 1
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center'
    },
    loadingSubtext: {
        marginTop: 6,
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center'
    }
});
