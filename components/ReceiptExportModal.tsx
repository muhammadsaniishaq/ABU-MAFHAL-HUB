import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptData, downloadReceiptAsPDF, downloadReceiptAsPNG } from '../services/receiptGenerator';

interface Props {
  visible: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

export default function ReceiptExportModal({ visible, onClose, receiptData }: Props) {
  const [downloadingType, setDownloadingType] = useState<'pdf' | 'png' | null>(null);

  if (!receiptData) return null;

  const handleDownloadPDF = async () => {
    try {
      setDownloadingType('pdf');
      const res = await downloadReceiptAsPDF(receiptData);
      if (res && Platform.OS !== 'web') {
        // Shared via native share sheet
      }
    } catch (e: any) {
      Alert.alert('Download Error', e.message || 'Could not generate PDF receipt.');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPNG = async () => {
    try {
      setDownloadingType('png');
      const res = await downloadReceiptAsPNG(receiptData);
      if (res && Platform.OS !== 'web') {
        // Shared via native share sheet
      }
    } catch (e: any) {
      Alert.alert('Download Error', e.message || 'Could not generate PNG image receipt.');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={s.card} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={s.headerRow}>
            <View style={s.iconBox}>
              <Ionicons name="receipt" size={20} color="#FFD700" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.title}>Download Official Receipt</Text>
              <Text style={s.subtitle}>ABU MAFHAL SUB • RC-8979939</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={s.promptText}>
            Select your preferred file format to automatically download and save to your phone:
          </Text>

          {/* Option 1: PDF */}
          <TouchableOpacity
            style={[s.optionBtn, downloadingType === 'pdf' && s.optionBtnActive]}
            onPress={handleDownloadPDF}
            disabled={downloadingType !== null}
            activeOpacity={0.8}
          >
            <View style={[s.optionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
              <Ionicons name="document-text" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Download PDF Receipt (.pdf)</Text>
              <Text style={s.optionSub}>Crisp vector document for accounting & print</Text>
            </View>
            {downloadingType === 'pdf' ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#FFD700" />
            )}
          </TouchableOpacity>

          {/* Option 2: PNG Image */}
          <TouchableOpacity
            style={[s.optionBtn, downloadingType === 'png' && s.optionBtnActive]}
            onPress={handleDownloadPNG}
            disabled={downloadingType !== null}
            activeOpacity={0.8}
          >
            <View style={[s.optionIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
              <Ionicons name="image" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Download PNG Image (.png)</Text>
              <Text style={s.optionSub}>High-resolution photo for gallery & WhatsApp</Text>
            </View>
            {downloadingType === 'png' ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#FFD700" />
            )}
          </TouchableOpacity>

          {/* Footer note */}
          <View style={s.footerBox}>
            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            <Text style={s.footerText}>
              Official receipt issued by <Text style={{ color: '#FFD700', fontWeight: '800' }}>ABU MAFHAL LTD</Text> (RC-8979939)
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(218, 165, 32, 0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  optionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  optionBtnActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  optionSub: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  footerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
});
