import React, { useRef } from 'react';
import { View, Modal, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PaystackPaymentProps {
    visible: boolean;
    amount: number; // in Naira
    email: string;
    publicKey: string;
    onSuccess: (response: any) => void;
    onCancel: () => void;
    onClose: () => void;
}

export default function PaystackPayment({ visible, amount, email, publicKey, onSuccess, onCancel, onClose }: PaystackPaymentProps) {
    const webViewRef = useRef<WebView>(null);

    // Amount needs to be passed in kobo to Paystack (N1 = 100 kobo)
    const amountKobo = amount * 100;

    const paystackHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background-color: #ffffff; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            #status { margin-bottom: 20px; font-size: 16px; color: #333; text-align: center; padding: 20px; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #0056D2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .error { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body style="background-color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div id="loader" class="loader"></div>
            <div id="status">Connecting to Paystack...</div>
            
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
                        updateStatus("Initializing Payment...", false);
                        var handler = PaystackPop.setup({
                            key: '${publicKey}',
                            email: '${email}',
                            amount: ${amountKobo},
                            currency: 'NGN',
                            ref: 'PAY-' + Math.floor((Math.random() * 1000000000) + 1),
                            callback: function(response) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'success', data: response}));
                            },
                            onClose: function() {
                                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'cancel'}));
                            }
                        });
                        handler.openIframe();
                         setTimeout(function(){
                            document.getElementById('loader').style.display = 'none';
                            document.getElementById('status').style.display = 'none';
                        }, 2000);
                    } catch (e) {
                         updateStatus("Error: " + e.message, true);
                    }
                }
            </script>
            <script src="https://js.paystack.co/v1/inline.js" onload="payWithPaystack()" onerror="updateStatus('Failed to load Paystack script. Check internet.', true)"></script>
        </body>
      </html>
    `;

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'success') {
                onSuccess(data.data);
                onClose();
            } else if (data.type === 'cancel') {
                onCancel();
                onClose();
            } else if (data.type === 'error') {
                 console.log("Webview Error:", data.message);
            }
        } catch (e) {
            console.log("Paystack Webview Error:", e);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'white', zIndex: 10 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#1E293B' }}>Complete Payment</Text>
                    <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: '#F3F4F6', borderRadius: 999 }}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: paystackHtml, baseUrl: 'https://standard.paystack.co' }}
                    onMessage={handleMessage}
                    startInLoadingState={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    mixedContentMode="always"
                    allowFileAccess={true}
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                    }}
                    renderLoading={() => (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
                            <ActivityIndicator size="large" color="#0056D2" />
                        </View>
                    )}
                />
            </SafeAreaView>
        </Modal>
    );
}
