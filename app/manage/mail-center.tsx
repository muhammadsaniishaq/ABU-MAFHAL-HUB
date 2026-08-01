import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  FlatList, 
  Dimensions, 
  RefreshControl 
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { AIService } from '../../services/ai';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const { width: W } = Dimensions.get('window');

const DOMAIN = 'abumafhal.com.ng';

interface InAppEmail {
  id: string;
  sender_email: string;
  sender_name?: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  is_read: boolean;
  folder: 'inbox' | 'sent' | 'archive';
  created_at: string;
}

interface CorporateEmail {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface MailAttachment {
  name: string;
  uri: string;
  size?: number;
  type: string;
}

const AI_EMAIL_PRESETS = [
  {
    id: 'welcome',
    title: '🚀 VIP Welcome',
    subject: 'Welcome to Abu Mafhal Sub - Your Gateway to Digital Finance!',
    prompt: 'Write a warm, professional welcome message to a new user introducing Abu Mafhal VTU, Virtual Cards, and Crypto trading services.'
  },
  {
    id: 'kyc',
    title: '🛡️ KYC Upgrade Request',
    subject: 'Action Required: Upgrade Your Identity Verification',
    prompt: 'Write an official compliance notice requesting the user to upload their NIN or BVN to unlock higher transaction limits.'
  },
  {
    id: 'security',
    title: '⚠️ Security Alert',
    subject: 'Security Alert: New Sign-in Detected',
    prompt: 'Write an urgent security alert notifying the user of a login attempt and instructing them to reset transaction PIN if suspicious.'
  },
  {
    id: 'maint',
    title: '📢 System Maintenance',
    subject: 'Notice: Scheduled Server Upgrades',
    prompt: 'Write a polite notification informing users of brief system maintenance at 2 AM tonight and assuring fund safety.'
  },
  {
    id: 'promo',
    title: '🎁 Cashback Promotion',
    subject: 'Special Offer: 5% Cashback on All Data Bundles!',
    prompt: 'Write an exciting promotional offer email announcing 5% cashback on data and airtime purchases this weekend.'
  }
];

const formatMailTime = (createdAt?: string) => {
  if (!createdAt) return '';
  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

export default function MailCenterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'accounts'>((params.tab as any) || 'inbox');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // Mail Collections
  const [emails, setEmails] = useState<InAppEmail[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateEmail[]>([]);

  // Selected Email Reader Modal
  const [selectedMail, setSelectedMail] = useState<InAppEmail | null>(null);

  // Compose Modal State & Enhancements
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeMode, setComposeMode] = useState<'edit' | 'preview'>('edit');
  const [senderAccount, setSenderAccount] = useState(`admin@${DOMAIN}`);
  const [recipientInput, setRecipientInput] = useState((params.recipient as string) || '');
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  // AI Assistant & Attachments State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);

  // Create Corporate Admin Email Modal State (Super Admin)
  const [createAdminMailVisible, setCreateAdminMailVisible] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPassword, setAdminPassword] = useState('Password123!');
  const [adminRole, setAdminRole] = useState<'admin' | 'super_admin'>('admin');
  const [creatingAdminMail, setCreatingAdminMail] = useState(false);
  const [showCorporatePassword, setShowCorporatePassword] = useState(false);
  const [copiedCorpEmail, setCopiedCorpEmail] = useState(false);

  const generateCorpPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(pass);
  };

  useEffect(() => {
    initMailCenter();
  }, []);

  const initMailCenter = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || '');
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role) setUserRole(profile.role);

        // AUTO-DETECT ADMIN'S CORPORATE EMAIL DIRECTLY FROM LOGGED-IN ACCOUNT
        const { data: userCorp } = await supabase
          .from('corporate_admin_emails')
          .select('email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userCorp?.email) {
          setSenderAccount(userCorp.email);
        } else if (user.email?.endsWith(`@${DOMAIN}`)) {
          setSenderAccount(user.email);
        } else {
          setSenderAccount(user.email || `support@${DOMAIN}`);
        }
      }

      await fetchMails();
      await fetchCorporateAccounts();
    } catch (e) {
      console.error("Mail Center Init Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('in_app_emails')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn("Fetch Mails DB Note:", error.message);
      }
      if (data) {
        setEmails(data as InAppEmail[]);
      }
    } catch (err) {
      console.error("Fetch Mails Error:", err);
    }
  };

  const fetchCorporateAccounts = async () => {
    try {
      const { data } = await supabase
        .from('corporate_admin_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setCorporateAccounts(data as CorporateEmail[]);
      }
    } catch (err) {
      console.warn("Fetch Corporate Accounts Warning:", err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMails();
    await fetchCorporateAccounts();
    setRefreshing(false);
  };

  const handleCreateCorporateEmail = async () => {
    const cleanUsername = adminUsername.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!cleanUsername) {
      return Alert.alert("Required", "Please enter a valid email prefix (e.g. musa)");
    }
    if (!adminFullName.trim()) {
      return Alert.alert("Required", "Please enter Full Name of the admin staff");
    }

    const fullCorporateEmail = `${cleanUsername}@${DOMAIN}`;

    try {
      setCreatingAdminMail(true);

      // Check if corporate email handle already exists in DB
      const { data: existingCorp } = await supabase
        .from('corporate_admin_emails')
        .select('id, username, email')
        .or(`username.eq.${cleanUsername},email.eq.${fullCorporateEmail}`)
        .maybeSingle();

      if (existingCorp) {
        setCreatingAdminMail(false);
        return Alert.alert('Already Exists ⚠️', `The corporate email handle '${fullCorporateEmail}' already exists! Please choose a different handle.`);
      }

      // A. Create User in Auth & Profiles (or link existing)
      const { data: authData } = await supabase.auth.signUp({
        email: fullCorporateEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: adminFullName.trim(),
            role: adminRole
          }
        }
      });

      const newUserId = authData.user?.id;

      // B. Update Profile Role
      if (newUserId) {
        await supabase.from('profiles').upsert({
          id: newUserId,
          email: fullCorporateEmail,
          full_name: adminFullName.trim(),
          role: adminRole,
          status: 'active'
        }, { onConflict: 'id' });
      }

      // C. Save to corporate_admin_emails table
      const { error: corpErr } = await supabase.from('corporate_admin_emails').insert({
        user_id: newUserId || null,
        username: cleanUsername,
        email: fullCorporateEmail,
        display_name: adminFullName.trim(),
        role: adminRole
      });

      if (corpErr) {
        setCreatingAdminMail(false);
        return Alert.alert('Creation Error ⚠️', corpErr.message || `Corporate email ${fullCorporateEmail} already exists or could not be created.`);
      }

      // DIRECT PROVISIONING TO ZOHO ORGANIZATION MAIL API
      try {
        await supabase.functions.invoke('create-zoho-user', {
          body: { username: cleanUsername, fullName: adminFullName.trim(), password: adminPassword }
        });
      } catch (zohoErr) {
        console.warn("Direct Zoho API provision note:", zohoErr);
      }

      // D. Send Welcome Email in-app
      await supabase.from('in_app_emails').insert({
        sender_email: `system@${DOMAIN}`,
        sender_name: 'Abu Mafhal Domain Authority',
        recipient_email: fullCorporateEmail,
        subject: `Welcome to Abu Mafhal Corporate Mail (${fullCorporateEmail})`,
        body_text: `Congratulations ${adminFullName.trim()}!\n\nYour official corporate email account ${fullCorporateEmail} has been activated with ${adminRole.toUpperCase()} permissions.\n\nTemporary Password: ${adminPassword}`,
        is_read: false,
        folder: 'inbox'
      });

      Alert.alert("Corporate Mail Created 🎉", `Official Email ${fullCorporateEmail} created successfully!\n\nCredentials sent to in-app mailbox.`);
      setCreateAdminMailVisible(false);
      setAdminUsername('');
      setAdminFullName('');
      fetchCorporateAccounts();
      fetchMails();
    } catch (err: any) {
      Alert.alert("Creation Error", err.message || "Failed to create corporate email");
    } finally {
      setCreatingAdminMail(false);
    }
  };

  // Pick Document / PDF
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const doc = res.assets[0];
        setAttachments(prev => [
          ...prev,
          {
            name: doc.name,
            uri: doc.uri,
            size: doc.size,
            type: doc.mimeType || 'application/octet-stream'
          }
        ]);
      }
    } catch (err: any) {
      Alert.alert("Attachment Error", err.message || "Failed to attach file");
    }
  };

  // Pick Image / Gallery
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return Alert.alert("Permission Required", "Please allow access to gallery to attach images.");
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const img = res.assets[0];
        const fileName = img.uri.split('/').pop() || 'attached_image.jpg';
        setAttachments(prev => [
          ...prev,
          {
            name: fileName,
            uri: img.uri,
            size: img.fileSize,
            type: img.mimeType || 'image/jpeg'
          }
        ]);
      }
    } catch (err: any) {
      Alert.alert("Image Error", err.message || "Failed to attach image");
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // AI Generator Handler (OpenAI Neural API + Bilingual Engine)
  const handleGenerateAiEmail = async (preset?: typeof AI_EMAIL_PRESETS[0]) => {
    try {
      setAiGenerating(true);
      const promptToUse = preset ? preset.prompt : aiCustomPrompt.trim();
      const presetTitle = preset ? preset.title : undefined;

      if (!promptToUse) {
        setAiGenerating(false);
        return Alert.alert("Instruction Required", "Please select an AI topic preset or type your custom instruction in Hausa/English.");
      }

      const generated = await AIService.generateEmail(promptToUse, presetTitle);

      if (generated?.subject && generated?.body) {
        setSubjectInput(generated.subject);
        setBodyInput(generated.body);
        setAiModalVisible(false);
        setAiCustomPrompt('');
        Alert.alert("AI Draft Formatted ✨", "Cortex AI has written a professional corporate email based on your instruction!");
      } else {
        Alert.alert("Generation Note", "AI engine could not format the output. Please try again.");
      }
    } catch (err: any) {
      Alert.alert("AI Engine Error", err.message || "Failed to generate email content");
    } finally {
      setAiGenerating(false);
    }
  };

  // 2. Send Official Mail
  const handleSendOfficialMail = async () => {
    const rawRecipient = recipientInput.trim();
    if (!rawRecipient) {
      return Alert.alert("Required", "Please specify recipient email address");
    }
    if (!subjectInput.trim() || !bodyInput.trim()) {
      return Alert.alert("Required", "Please fill in Subject and Mail Message body");
    }

    try {
      setSendingMail(true);

      let targetProfiles: { id?: string; email: string }[] = [];

      if (rawRecipient.toLowerCase() === 'all' || rawRecipient.toLowerCase() === 'all_users') {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .not('email', 'is', null);

        if (userProfiles && userProfiles.length > 0) {
          targetProfiles = userProfiles.filter(u => u.email).map(u => ({ id: u.id, email: u.email.toLowerCase() }));
        }
      } else if (rawRecipient.includes(',')) {
        const emails = rawRecipient.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
        if (emails.length > 0) {
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, email')
            .in('email', emails);

          const foundMap = new Map((userProfiles || []).map(u => [u.email.toLowerCase(), u.id]));
          targetProfiles = emails.map(e => ({ id: foundMap.get(e), email: e }));
        }
      } else {
        const singleEmail = rawRecipient.toLowerCase();
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', singleEmail)
          .maybeSingle();

        targetProfiles = [{ id: userProfile?.id, email: singleEmail }];
      }

      if (targetProfiles.length === 0) {
        throw new Error("No valid recipient email address specified.");
      }

      let attachmentText = '';
      let attachmentHtml = '';
      if (attachments.length > 0) {
        attachmentText = '\n\nAttached Files:\n' + attachments.map(a => `• ${a.name} (${a.type})`).join('\n');
        attachmentHtml = `<div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;"><p style="margin: 0 0 6px 0; font-size: 11px; color: #f5a623; font-weight: bold;">ATTACHMENTS (${attachments.length}):</p>` +
          attachments.map(a => `<p style="margin: 2px 0; font-size: 11px; color: #cbd5e1;">📎 ${a.name}</p>`).join('') +
          `</div>`;
      }

      const finalBodyText = bodyInput.trim() + attachmentText;
      const formattedHtml = `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #ffffff; border-radius: 12px;"><h2 style="color: #f5a623; margin-top: 0;">${subjectInput.trim()}</h2><p style="font-size: 14px; line-height: 1.6;">${bodyInput.trim().replace(/\n/g, '<br/>')}</p>${attachmentHtml}<hr style="border-color: #334155; margin-top: 20px;"/><p style="font-size: 11px; color: #94a3b8;">Sent via Abu Mafhal Corporate Mail System (${senderAccount})</p></div>`;

      // 1. Batch Insert into in_app_emails for Inbox & Sent Items
      const inboxRecords = targetProfiles.map(p => ({
        sender_email: senderAccount,
        sender_name: 'Abu Mafhal Official',
        recipient_email: p.email,
        subject: subjectInput.trim(),
        body_text: finalBodyText,
        body_html: formattedHtml,
        is_read: false,
        folder: 'inbox',
        metadata: { attachments: attachments }
      }));

      const sentRecord = {
        sender_email: senderAccount,
        sender_name: 'Abu Mafhal Official',
        recipient_email: targetProfiles.map(p => p.email).join(', '),
        subject: subjectInput.trim(),
        body_text: finalBodyText,
        body_html: formattedHtml,
        is_read: true,
        folder: 'sent',
        metadata: { attachments: attachments }
      };

      await supabase.from('in_app_emails').insert([...inboxRecords, sentRecord]);

      // 2. Batch Insert into notifications table (so users receive Broadcast Notification alerts in app)
      const validUserIds = targetProfiles.map(p => p.id).filter(Boolean) as string[];
      if (validUserIds.length > 0) {
        const notifRecords = validUserIds.map(userId => ({
          user_id: userId,
          title: subjectInput.trim(),
          body: bodyInput.trim(),
          type: 'email',
          data: { priority: 'high', route: '/manage/mail-center' },
          created_at: new Date().toISOString()
        }));

        const { error: notifErr } = await supabase.from('notifications').insert(notifRecords);
        if (notifErr) {
          console.warn("notifications broadcast batch insert note:", notifErr.message);
        }
      }

      // 3. Log to communication_logs
      try {
        await supabase.from('communication_logs').insert({
          channel: 'email',
          recipient: rawRecipient,
          subject: subjectInput.trim(),
          content: bodyInput.trim(),
          status: 'sent',
          metadata: { sender: senderAccount, total_recipients: targetProfiles.length }
        });
      } catch (logErr) {}

      // 4. Update UI Local State immediately
      const newMailObject: InAppEmail = {
        id: 'mail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sender_email: senderAccount,
        sender_name: 'Abu Mafhal Official',
        recipient_email: targetProfiles[0].email,
        subject: subjectInput.trim(),
        body_text: finalBodyText,
        body_html: formattedHtml,
        is_read: true,
        folder: 'sent',
        created_at: new Date().toISOString()
      };
      setEmails(prev => [newMailObject, ...prev]);

      // 5. Trigger External Email Dispatch & Corporate Email Forwarding + Push Notification
      for (const p of targetProfiles.slice(0, 10)) {
        try {
          const targetCleanEmail = p.email.toLowerCase().trim();

          const { error: invokeErr } = await supabase.functions.invoke('send-email', {
            body: {
              to: targetCleanEmail,
              from: senderAccount,
              subject: subjectInput.trim(),
              text: finalBodyText,
              html: formattedHtml
            }
          });

          if (invokeErr) {
            console.warn("Edge Function note, checking direct Resend API fallback...", invokeErr.message);
            const { data: resendSecret } = await supabase
              .from('system_secrets')
              .select('value')
              .eq('key', 'RESEND_API_KEY')
              .maybeSingle();

            if (resendSecret?.value) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${resendSecret.value.trim()}`
                },
                body: JSON.stringify({
                  from: 'Abu Mafhal Sub <onboarding@resend.dev>',
                  reply_to: senderAccount,
                  to: [targetCleanEmail],
                  subject: subjectInput.trim(),
                  text: finalBodyText,
                  html: formattedHtml
                })
              });
            }
          }

          // CORPORATE FORWARDING TO ADMIN'S PERSONAL REGISTERED EMAIL + PUSH NOTIFICATION
          const { data: corpAdmin } = await supabase
            .from('corporate_admin_emails')
            .select('user_id, display_name')
            .eq('email', targetCleanEmail)
            .maybeSingle();

          if (corpAdmin?.user_id) {
            // A. Trigger Push Notification to Admin's App
            await supabase.from('notifications').insert({
              user_id: corpAdmin.user_id,
              title: `📨 New Official Email: ${subjectInput.trim().slice(0, 45)}`,
              body: `Received from ${senderAccount}. Open Mail Center to read full message.`,
              type: 'email',
              data: { priority: 'high', route: '/manage/mail-center', sender: senderAccount },
              created_at: new Date().toISOString()
            });

            // B. Forward email to Admin's personal registered email profile
            const { data: adminProf } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', corpAdmin.user_id)
              .maybeSingle();

            const personalEmail = adminProf?.email?.toLowerCase().trim();
            if (personalEmail && personalEmail !== targetCleanEmail) {
              try {
                await supabase.functions.invoke('send-email', {
                  body: {
                    to: personalEmail,
                    from: senderAccount,
                    subject: `[Corporate FWD: ${corpAdmin.display_name}] ${subjectInput.trim()}`,
                    text: finalBodyText,
                    html: formattedHtml
                  }
                });
              } catch (fwdErr) {
                console.warn("Personal mail forward note:", fwdErr);
              }
            }
          }
        } catch (edgeErr) {
          console.warn("External email dispatch note:", edgeErr);
        }
      }

      Alert.alert("Email Dispatched 🎉", `Official email successfully dispatched to ${targetProfiles.length} recipient(s) & broadcast notifications delivered!`);
      setComposeVisible(false);
      setSubjectInput('');
      setBodyInput('');
      setRecipientInput('');
      setAttachments([]);
      setActiveTab('sent');
      await fetchMails();
    } catch (err: any) {
      Alert.alert("Send Error ⚠️", err.message || "Failed to deliver email. Please check internet connection.");
    } finally {
      setSendingMail(false);
    }
  };


  // Mark as read
  const handleOpenMail = async (mail: InAppEmail) => {
    setSelectedMail(mail);
    if (!mail.is_read) {
      await supabase.from('in_app_emails').update({ is_read: true }).eq('id', mail.id);
      setEmails(prev => prev.map(m => m.id === mail.id ? { ...m, is_read: true } : m));
    }
  };

  const filteredMails = (emails || []).filter(m => {
    if (!m) return false;
    const recipient = (m.recipient_email || '').toLowerCase();
    const sender = (m.sender_email || '').toLowerCase();
    const userEm = (currentUserEmail || '').toLowerCase();

    const activeCorpEmails = corporateAccounts.map(c => c.email.toLowerCase());
    const isRecipientForMe = recipient === userEm || activeCorpEmails.includes(recipient);
    const isSenderFromMe = sender === userEm || activeCorpEmails.includes(sender);

    if (activeTab === 'inbox') {
      return (m.folder === 'inbox' || !m.folder) && (isRecipientForMe || (!userEm && recipient.includes(`@${DOMAIN}`)));
    }
    if (activeTab === 'sent') {
      return m.folder === 'sent' || isSenderFromMe;
    }
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <Stack.Screen 
        options={{
          title: 'OFFICIAL CORPORATE MAIL CENTER',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f5a623',
          headerTitleStyle: { fontWeight: '900', fontSize: 14 }
        }} 
      />

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f5a623']} />}
      >
        {/* Luxury Header Card */}
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={{ padding: 18, borderRadius: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#f5a623' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
                <Ionicons name="mail" size={12} color="#f5a623" />
                <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>DOMAIN: @{DOMAIN}</Text>
              </View>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 8 }}>Official App Mailbox</Text>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Direct Email Dispatch & In-App Customer Inbox</Text>
            </View>

            <TouchableOpacity 
              onPress={() => setComposeVisible(true)}
              style={{ backgroundColor: '#f5a623', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4 }}
            >
              <Ionicons name="create-outline" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Quick Stats Bar */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}>
              <Text style={{ color: '#94a3b8', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Unread Mails</Text>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', marginTop: 2 }}>{emails.filter(e => !e.is_read).length}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}>
              <Text style={{ color: '#94a3b8', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Admin Emails</Text>
              <Text style={{ color: '#f5a623', fontSize: 16, fontWeight: '900', marginTop: 2 }}>{corporateAccounts.length || 1}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={{ flexDirection: 'row', backgroundColor: '#ffffff', padding: 4, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
          <TouchableOpacity 
            onPress={() => setActiveTab('inbox')}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: activeTab === 'inbox' ? '#0f172a' : 'transparent' }}
          >
            <Text style={{ color: activeTab === 'inbox' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 12 }}>📥 Inbox</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('sent')}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: activeTab === 'sent' ? '#0f172a' : 'transparent' }}
          >
            <Text style={{ color: activeTab === 'sent' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 12 }}>📤 Sent Mails</Text>
          </TouchableOpacity>

          {(userRole === 'super_admin' || userRole === 'admin') && (
            <TouchableOpacity 
              onPress={() => setActiveTab('accounts')}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: activeTab === 'accounts' ? '#0f172a' : 'transparent' }}
            >
              <Text style={{ color: activeTab === 'accounts' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 12 }}>👑 Admin Emails</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Content: Admin Accounts Creation (Super Admin) */}
        {activeTab === 'accounts' && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Official Domain Accounts (@{DOMAIN})</Text>
              {userRole === 'super_admin' && (
                <TouchableOpacity 
                  onPress={() => setCreateAdminMailVisible(true)}
                  style={{ backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#f5a623" />
                  <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 11 }}>+ Create Admin Email</Text>
                </TouchableOpacity>
              )}
            </View>

            {corporateAccounts.length === 0 ? (
              <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Ionicons name="at-circle-outline" size={32} color="#cbd5e1" />
                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700', marginTop: 8 }}>No custom domain admin emails created yet.</Text>
                <TouchableOpacity onPress={() => setCreateAdminMailVisible(true)} style={{ marginTop: 12, backgroundColor: '#f5a623', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 11 }}>Create First Corporate Email</Text>
                </TouchableOpacity>
              </View>
            ) : (
              corporateAccounts.map(account => (
                <View key={account.id} style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="at" size={18} color="#f5a623" />
                    </View>
                    <View>
                      <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13 }}>{account.display_name}</Text>
                      <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 11 }}>{account.email}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: account.role === 'super_admin' ? '#fffbeb' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: account.role === 'super_admin' ? '#fde68a' : '#bfdbfe' }}>
                    <Text style={{ color: account.role === 'super_admin' ? '#d97706' : '#2563eb', fontWeight: '900', fontSize: 9 }}>{account.role.toUpperCase()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab Content: Inbox / Sent Mail List */}
        {(activeTab === 'inbox' || activeTab === 'sent') && (
          <View style={{ gap: 10 }}>
            {loading ? (
              <ActivityIndicator size="small" color="#f5a623" style={{ padding: 20 }} />
            ) : filteredMails.length === 0 ? (
              <View style={{ backgroundColor: '#ffffff', padding: 30, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Ionicons name="mail-unread-outline" size={36} color="#cbd5e1" />
                <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '700', marginTop: 8 }}>No emails in your {activeTab}.</Text>
              </View>
            ) : (
              filteredMails.map(mail => (
                <TouchableOpacity 
                  key={mail.id}
                  onPress={() => handleOpenMail(mail)}
                  activeOpacity={0.8}
                  style={{ 
                    backgroundColor: mail.is_read ? '#ffffff' : '#f0f9ff', 
                    padding: 14, 
                    borderRadius: 16, 
                    borderWidth: 1, 
                    borderColor: mail.is_read ? '#e2e8f0' : '#bae6fd',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mail.is_read ? '#cbd5e1' : '#0284c7' }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#0f172a', fontWeight: mail.is_read ? '700' : '900', fontSize: 13 }} numberOfLines={1}>
                        {activeTab === 'inbox' ? mail.sender_email : `To: ${mail.recipient_email}`}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '600' }}>
                        {formatMailTime(mail?.created_at)}
                      </Text>
                    </View>
                    <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{mail.subject}</Text>
                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }} numberOfLines={2}>{mail.body_text}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Compose Button */}
      <TouchableOpacity 
        onPress={() => setComposeVisible(true)}
        style={{ position: 'absolute', bottom: 24, right: 20, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 30, elevation: 6, borderWidth: 1, borderColor: '#f5a623' }}
      >
        <Ionicons name="send" size={16} color="#f5a623" />
        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>Compose Mail</Text>
      </TouchableOpacity>

      {/* MODAL 1: Create Corporate Admin Email (Super Admin) */}
      <Modal visible={createAdminMailVisible} transparent animationType="slide" onRequestClose={() => setCreateAdminMailVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#e2e8f0' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 6 }}>
                  <Ionicons name="at-circle" size={14} color="#d97706" />
                  <Text style={{ color: '#b45309', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>Domain Authority @{DOMAIN}</Text>
                </View>
                <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 17 }}>Create Corporate Admin Email</Text>
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '400', marginTop: 2 }}>Provision official staff email address & credentials.</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setCreateAdminMailVisible(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Email Handle (@{DOMAIN}) *</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 }}>
              <TextInput 
                placeholder="e.g. musa"
                value={adminUsername}
                onChangeText={(t) => setAdminUsername(t.toLowerCase())}
                style={{ flex: 1, paddingVertical: 10, color: '#0f172a', fontWeight: '600', fontSize: 13 }}
                autoCapitalize="none"
              />
              <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 12 }}>@{DOMAIN}</Text>
            </View>

            {/* Live Domain Badge */}
            <View style={{ backgroundColor: '#0f172a', padding: 10, borderRadius: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                <Ionicons name="mail-open-outline" size={14} color="#f5a623" />
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '400' }}>
                  Live Corporate Email: <Text style={{ color: '#f5a623', fontWeight: '700' }}>{(adminUsername.trim() || 'musa').toLowerCase()}@{DOMAIN}</Text>
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  const mailStr = `${(adminUsername.trim() || 'musa').toLowerCase()}@${DOMAIN}`;
                  try {
                    const { Clipboard } = require('react-native');
                    Clipboard.setString(mailStr);
                  } catch (e) {}
                  setCopiedCorpEmail(true);
                  setTimeout(() => setCopiedCorpEmail(false), 2000);
                }}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name={copiedCorpEmail ? "checkmark" : "copy-outline"} size={12} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '600' }}>{copiedCorpEmail ? "Copied" : "Copy"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Staff Full Name *</Text>
            <TextInput 
              placeholder="e.g. Musa Ibrahim"
              value={adminFullName}
              onChangeText={setAdminFullName}
              style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '500', fontSize: 13, marginBottom: 12 }}
            />

            {/* Password Generator & Eye Toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600' }}>Initial Password *</Text>
              <TouchableOpacity onPress={generateCorpPassword}>
                <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 11 }}>🎲 Auto-Generate</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 }}>
              <TextInput 
                placeholder="Password123!"
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry={!showCorporatePassword}
                style={{ flex: 1, paddingVertical: 10, color: '#0f172a', fontWeight: '600', fontSize: 13 }}
              />
              <TouchableOpacity onPress={() => setShowCorporatePassword(!showCorporatePassword)}>
                <Ionicons name={showCorporatePassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Role Cards */}
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Corporate Permission Role</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setAdminRole('admin')}
                style={{ 
                  flex: 1, 
                  padding: 10, 
                  borderRadius: 12, 
                  borderWidth: 1.5, 
                  borderColor: adminRole === 'admin' ? '#0f172a' : '#e2e8f0', 
                  backgroundColor: adminRole === 'admin' ? '#0f172a' : '#ffffff' 
                }}
              >
                <Text style={{ color: adminRole === 'admin' ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 11 }}>Staff Admin 🛡️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAdminRole('super_admin')}
                style={{ 
                  flex: 1, 
                  padding: 10, 
                  borderRadius: 12, 
                  borderWidth: 1.5, 
                  borderColor: adminRole === 'super_admin' ? '#d97706' : '#e2e8f0', 
                  backgroundColor: adminRole === 'super_admin' ? '#fffbeb' : '#ffffff' 
                }}
              >
                <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 11 }}>Super Admin 👑</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleCreateCorporateEmail}
              disabled={creatingAdminMail}
              style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            >
              {creatingAdminMail ? (
                <ActivityIndicator color="#f5a623" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles-outline" size={16} color="#f5a623" />
                  <Text style={{ color: '#f5a623', fontWeight: '700', fontSize: 13 }}>Provision Corporate Account</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Compose Official Mail */}
      <Modal visible={composeVisible} transparent animationType="slide" onRequestClose={() => setComposeVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' }}>
            {/* Header with AI Writer Button */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 16 }}>Compose Official Email</Text>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '600' }}>Direct domain email dispatch with AI Assistant</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setAiModalVisible(true)}
                style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="sparkles" size={14} color="#d97706" />
                <Text style={{ color: '#d97706', fontWeight: '900', fontSize: 11 }}>AI Assist ✨</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setComposeVisible(false)} style={{ marginLeft: 8 }}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher: Edit vs Live Preview */}
            <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', padding: 3, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setComposeMode('edit')}
                style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 10, backgroundColor: composeMode === 'edit' ? '#0f172a' : 'transparent' }}
              >
                <Text style={{ color: composeMode === 'edit' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 11 }}>✍️ Edit Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setComposeMode('preview')}
                style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 10, backgroundColor: composeMode === 'preview' ? '#0f172a' : 'transparent' }}
              >
                <Text style={{ color: composeMode === 'preview' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 11 }}>👁️ Live Preview</Text>
              </TouchableOpacity>
            </View>

            {composeMode === 'preview' ? (
              <ScrollView style={{ minHeight: 250, maxHeight: 350, backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>LIVE EMAIL HTML PREVIEW</Text>
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', marginBottom: 10 }}>{subjectInput || 'Email Subject Line'}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11 }}>From: <Text style={{ color: '#f5a623', fontWeight: 'bold' }}>{senderAccount}</Text></Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>To: <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{recipientInput || 'recipient@example.com'}</Text></Text>
                </View>
                <Text style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 22 }}>{bodyInput || 'No message content written yet.'}</Text>

                {attachments.length > 0 && (
                  <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>ATTACHMENTS ({attachments.length}):</Text>
                    {attachments.map((att, i) => (
                      <Text key={i} style={{ color: '#cbd5e1', fontSize: 11 }}>📎 {att.name}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>From (Auto-Assigned Corporate Sender)</Text>
                <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 13 }}>{senderAccount}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 9.5, fontWeight: '600', marginTop: 2 }}>🔒 Linked directly from your logged-in Staff Account profile</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </View>

                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Recipient Email *</Text>
                <TextInput 
                  placeholder="user@example.com"
                  value={recipientInput}
                  onChangeText={setRecipientInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 10 }}
                />

                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Subject *</Text>
                <TextInput 
                  placeholder="Important Account Notification"
                  value={subjectInput}
                  onChangeText={setSubjectInput}
                  style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 10 }}
                />

                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Message Body *</Text>
                <TextInput 
                  placeholder="Type your official message here or tap AI Assist..."
                  value={bodyInput}
                  onChangeText={setBodyInput}
                  multiline
                  numberOfLines={6}
                  style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: '#0f172a', fontWeight: '600', fontSize: 13, minHeight: 120, textAlignVertical: 'top', marginBottom: 10 }}
                />

                {/* Attachments Section */}
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Attach Files (PDF / Image / Documents)</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TouchableOpacity 
                    onPress={handlePickDocument}
                    style={{ flex: 1, backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingVertical: 8, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="document-attach-outline" size={14} color="#0284c7" />
                    <Text style={{ color: '#0284c7', fontWeight: '900', fontSize: 10 }}>Attach PDF / Doc</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handlePickImage}
                    style={{ flex: 1, backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#f5d0fe', paddingVertical: 8, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="image-outline" size={14} color="#c026d3" />
                    <Text style={{ color: '#c026d3', fontWeight: '900', fontSize: 10 }}>Attach Image</Text>
                  </TouchableOpacity>
                </View>

                {/* Attached File Badges */}
                {attachments.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {attachments.map((file, idx) => (
                      <View key={idx} style={{ backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="attach" size={12} color="#f5a623" />
                        <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{file.name}</Text>
                        <TouchableOpacity onPress={() => handleRemoveAttachment(idx)}>
                          <Ionicons name="close-circle" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity 
                  onPress={handleSendOfficialMail}
                  disabled={sendingMail}
                  style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 20 }}
                >
                  {sendingMail ? (
                    <ActivityIndicator color="#f5a623" />
                  ) : (
                    <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}>Send Email Now 📤</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 4: AI Professional Email Generator */}
      <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 20, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={20} color="#d97706" />
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Cortex AI Email Generator</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>Quick AI Topic Presets</Text>
              <View style={{ gap: 8, marginBottom: 16 }}>
                {AI_EMAIL_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => handleGenerateAiEmail(preset)}
                    style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', padding: 12, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 12 }}>{preset.title}</Text>
                      <Text style={{ color: '#d97706', fontSize: 10, marginTop: 2 }} numberOfLines={1}>{preset.subject}</Text>
                    </View>
                    <Ionicons name="flash-outline" size={14} color="#d97706" />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Or Custom AI Prompt / Instruction</Text>
              <TextInput
                placeholder="e.g. Write an apology for server delay during updates..."
                value={aiCustomPrompt}
                onChangeText={setAiCustomPrompt}
                multiline
                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, color: '#0f172a', fontWeight: '600', fontSize: 12, minHeight: 70, textAlignVertical: 'top', marginBottom: 14 }}
              />

              <TouchableOpacity
                onPress={() => handleGenerateAiEmail()}
                disabled={aiGenerating}
                style={{ backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
              >
                {aiGenerating ? (
                  <ActivityIndicator color="#f5a623" />
                ) : (
                  <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>Generate AI Email ✨</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Email Reader Modal */}
      <Modal visible={!!selectedMail} transparent animationType="fade" onRequestClose={() => setSelectedMail(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 }}>
          {selectedMail && (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: '#2563eb', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Official App Message</Text>
                <TouchableOpacity onPress={() => setSelectedMail(null)}>
                  <Ionicons name="close" size={22} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 16, marginBottom: 8 }}>{selectedMail.subject}</Text>

              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#f5a623' }}>
                <Text style={{ color: '#64748b', fontSize: 11 }}>From: <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>{selectedMail.sender_email}</Text></Text>
                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>To: <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>{selectedMail.recipient_email}</Text></Text>
              </View>

              <ScrollView style={{ minHeight: 120, maxHeight: 300, marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontSize: 13, lineHeight: 20 }}>{selectedMail.body_text}</Text>
              </ScrollView>

              <TouchableOpacity 
                onPress={() => {
                  const replyTo = selectedMail.sender_email;
                  setSelectedMail(null);
                  setRecipientInput(replyTo);
                  setSubjectInput(`Re: ${selectedMail.subject}`);
                  setComposeVisible(true);
                }}
                style={{ backgroundColor: '#0f172a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>Reply To Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
