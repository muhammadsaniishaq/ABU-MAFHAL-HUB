import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, ActivityIndicator, Modal,
  KeyboardAvoidingView, Image,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";

const T = {
  navy: "#0d1b3e", navyMid: "#1e293b", gold: "#f5a623", goldDk: "#d97706",
  white: "#ffffff", bg: "#f4f6fb", border: "#e2e8f0", sub: "#64748b",
  text: "#0f172a", red: "#dc2626", redL: "#fef2f2", green: "#16a34a",
  greenL: "#f0fdf4", blue: "#2563eb", blueL: "#eff6ff",
};

const DEFAULT_SIM_PLANS = [
  { id: "67c31cc8f3f0f520426fe893", name: "Ratel SIM Card",  network: "ratel",  price: 3000, description: "Ratel Telecom Physical SIM card with instant activation", status: "on" },
  { id: "67c32387927afc9fa58e0595", name: "Kirani SIM Card", network: "kirani", price: 5900, description: "Kirani 4G LTE Physical SIM card with instant activation", status: "on" },
  { id: "67c32391927afc9fa58e0599", name: "Alpha SIM Card",  network: "alpha",  price: 2750, description: "Alpha Telecom Physical SIM card with instant activation",  status: "on" },
  { id: "67d204183bd4d1bd7d1a8fd",  name: "Smile SIM Card",  network: "smile",  price: 5000, description: "Smile 4G LTE broadband SIM card with instant activation",  status: "on" },
  { id: "6a9e0d7ec7aba8077b369f1",  name: "Sahal SIM Card",  network: "sahal",  price: 4500, description: "Sahal Telecom Physical SIM card with instant activation",  status: "on" },
  { id: "7b2c1e3fa9d8c6b5e4f7a2d1", name: "Vitel SIM Card",  network: "vitel",  price: 3500, description: "Vitel Telecom Physical SIM card with instant activation",  status: "on" },
];

const NETWORK_LOGOS: Record<string, any> = {
  ratel:  require("../../assets/images/ratel_alat.png"),
  kirani: require("../../assets/images/kirani.png"),
  alpha:  require("../../assets/images/alpha_logo.png"),
  smile:  require("../../assets/images/smile_logo.png"),
  sahal:  require("../../assets/images/sahal.png"),
  vitel:  require("../../assets/images/vitel.png"),
};

const NETWORK_COLORS: Record<string, string> = {
  ratel: "#B45309", kirani: "#2563EB", alpha: "#DC2626",
  smile: "#EC4899", sahal: "#E11D48", vitel: "#6366F1",
};

interface SimPlan {
  id: string; name: string; network: string;
  price: number; description: string; status: "on" | "off";
}

export default function SimPricingPage() {
  const router = useRouter();
  const [plans, setPlans]           = useState<SimPlan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SimPlan | null>(null);
  const [editPrice, setEditPrice]   = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [editStatus, setEditStatus] = useState<"on" | "off">("on");
  const [editName, setEditName]     = useState("");
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sim_plans_custom")
        .maybeSingle();

      if (data && data.value) {
        let parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlans(parsed);
          setLoading(false);
          return;
        }
      }
      setPlans(DEFAULT_SIM_PLANS as SimPlan[]);
    } catch {
      setPlans(DEFAULT_SIM_PLANS as SimPlan[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const saveAllPlansToDb = async (newPlansList: SimPlan[]) => {
    await supabase.from("app_settings").upsert({
      key: "sim_plans_custom",
      value: JSON.stringify(newPlansList),
      description: "Custom SIM pricing and hide status",
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });
  };

  const openEdit = (plan: SimPlan) => {
    setSelectedPlan(plan);
    setEditName(plan.name);
    setEditPrice(String(plan.price));
    setEditDesc(plan.description || "");
    setEditStatus(plan.status || "on");
    setEditModal(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const savePlan = async () => {
    if (!selectedPlan) return;
    const priceNum = Number(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast("Farashin da kuka sanya ba daidai ba ne", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = { ...selectedPlan, name: editName.trim(), price: priceNum, description: editDesc.trim(), status: editStatus };
      const updatedList = plans.map(p => p.id === selectedPlan.id ? updated : p);
      await saveAllPlansToDb(updatedList);
      setPlans(updatedList);
      setEditModal(false);
      showToast(`✓ ${updated.name} - ₦${priceNum.toLocaleString()} an sabunta`, "success");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (err: any) {
      showToast("Kuskure: " + (err?.message || "An samu matsala"), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (plan: SimPlan) => {
    const newStatus: "on" | "off" = plan.status === "on" ? "off" : "on";
    const updatedList: SimPlan[] = plans.map(p => p.id === plan.id ? { ...p, status: newStatus } : p);
    setPlans(updatedList);
    try {
      await saveAllPlansToDb(updatedList);
      showToast(newStatus === "on" ? `✓ ${plan.name} - An kunna` : `🚫 ${plan.name} - An ɓoye`, newStatus === "on" ? "success" : "error");
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    } catch {
      showToast("Matsalar sadarwa wajen canza status", "error");
    }
  };

  const netColor = (netId: string) => NETWORK_COLORS[netId] || T.navy;

  return (
    <>
      <Stack.Screen options={{ title: "SIM Pricing", headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: T.bg }}>

        {/* Header */}
        <LinearGradient colors={[T.navy, "#142258"]} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerTitle}>SIM Card Pricing</Text>
            <Text style={s.headerSub}>Sabunta farashin SIM cards na kowane network</Text>
          </View>
          <TouchableOpacity onPress={loadPlans} style={[s.iconBtn, { backgroundColor: "rgba(245,166,35,0.2)" }]}>
            <Ionicons name="refresh" size={18} color={T.gold} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Toast */}
        {toast && (
          <View style={[s.toast, { backgroundColor: toast.type === "success" ? "#064E3B" : "#7F1D1D" }]}>
            <Ionicons name={toast.type === "success" ? "checkmark-circle" : "alert-circle"} size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.toastTxt}>{toast.msg}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={s.statsBar}>
          {[
            { val: plans.length, lbl: "Jimillar SIM", color: T.navy },
            { val: plans.filter(p => p.status === "on").length, lbl: "Active", color: T.green },
            { val: plans.filter(p => p.status === "off").length, lbl: "Hidden", color: T.red },
            { val: plans.length > 0 ? "₦" + Math.min(...plans.map(p => p.price)).toLocaleString() : "-", lbl: "Min Price", color: T.gold },
          ].map((st, i) => (
            <View key={i} style={[s.statItem, i > 0 && s.statDiv]}>
              <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={s.statLbl}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {/* List */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={T.navy} />
            <Text style={{ color: T.sub, marginTop: 10, fontSize: 13 }}>Ana loda...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLbl}>
              SIM Cards ({plans.length})
            </Text>

            {plans.map(plan => {
              const color = netColor(plan.network);
              const isActive = plan.status === "on";
              return (
                <View key={plan.id} style={[s.card, !isActive && { opacity: 0.6 }]}>
                  <View style={[s.cardStripe, { backgroundColor: color }]} />
                  <View style={s.cardBody}>
                    {/* Top Row */}
                    <View style={s.cardTop}>
                      <View style={[s.logoBox, { borderColor: color + "44" }]}>
                        {NETWORK_LOGOS[plan.network] ? (
                          <Image source={NETWORK_LOGOS[plan.network]} style={s.logo as any} resizeMode="contain" />
                        ) : (
                          <Ionicons name="hardware-chip" size={24} color={color} />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                          <Text style={s.cardName}>{plan.name}</Text>
                          <View style={[s.netBadge, { backgroundColor: color + "18", borderColor: color + "55" }]}>
                            <Text style={[s.netBadgeTxt, { color }]}>{plan.network.toUpperCase()}</Text>
                          </View>
                          <View style={[s.statusBadge, { backgroundColor: isActive ? "#DCFCE7" : "#FEE2E2", borderColor: isActive ? "#86EFAC" : "#FECACA" }]}>
                            <View style={[s.dot, { backgroundColor: isActive ? T.green : T.red }]} />
                            <Text style={[s.dotTxt, { color: isActive ? T.green : T.red }]}>{isActive ? "Active" : "Hidden"}</Text>
                          </View>
                        </View>
                        <Text style={s.cardDesc} numberOfLines={2}>{plan.description}</Text>
                      </View>
                    </View>

                    {/* Price + Actions */}
                    <View style={s.priceRow}>
                      <View>
                        <Text style={s.priceLbl}>Farashi</Text>
                        <Text style={[s.priceVal, { color }]}>₦{plan.price.toLocaleString()}</Text>
                      </View>
                      <View style={s.actBtns}>
                        <TouchableOpacity
                          onPress={() => toggleStatus(plan)}
                          style={[s.actBtn, { backgroundColor: isActive ? "#FEF2F2" : "#F0FDF4", borderColor: isActive ? "#FECACA" : "#BBF7D0" }]}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={isActive ? "eye-off-outline" : "eye-outline"} size={15} color={isActive ? T.red : T.green} />
                          <Text style={[s.actBtnTxt, { color: isActive ? T.red : T.green }]}>{isActive ? "Hide" : "Show"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openEdit(plan)}
                          style={[s.actBtn, { backgroundColor: T.blueL, borderColor: "#BFDBFE" }]}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="pencil" size={15} color={T.blue} />
                          <Text style={[s.actBtnTxt, { color: T.blue }]}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Plan ID */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                      <Ionicons name="key-outline" size={10} color={T.sub} style={{ marginRight: 4 }} />
                      <Text style={s.idTxt} numberOfLines={1}>Plan ID: {plan.id}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Info Note */}
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={T.blue} style={{ marginRight: 8 }} />
              <Text style={s.infoTxt}>
                Danna Edit don canza farashi ko suna. Danna Hide/Show don ɓoye ko nuna SIM card a app. Canje-canje suna aiki nan take.
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Edit Modal */}
        <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={s.overlay}>
              <View style={s.modalBox}>
                <LinearGradient colors={[T.navy, "#142258"]} style={s.modalHead}>
                  <View>
                    <Text style={s.modalTitle}>✏️ Sabunta SIM</Text>
                    <Text style={s.modalSub}>{selectedPlan?.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEditModal(false)}>
                    <Ionicons name="close-circle" size={26} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </LinearGradient>

                <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Network badge */}
                  {selectedPlan && (
                    <View style={[s.netBadgeBox, { backgroundColor: netColor(selectedPlan.network) + "18", borderColor: netColor(selectedPlan.network) + "55" }]}>
                      {NETWORK_LOGOS[selectedPlan.network] && (
                        <Image source={NETWORK_LOGOS[selectedPlan.network]} style={{ width: 32, height: 32, marginRight: 10 }} resizeMode="contain" />
                      )}
                      <View>
                        <Text style={[s.netBadgeBig, { color: netColor(selectedPlan.network) }]}>
                          {selectedPlan.network.toUpperCase()} NETWORK
                        </Text>
                        <Text style={s.netBadgeSub}>Plan ID: {selectedPlan.id}</Text>
                      </View>
                    </View>
                  )}

                  <Text style={s.lbl}>Suna (Name)</Text>
                  <TextInput style={s.input} value={editName} onChangeText={setEditName} placeholder="e.g. Ratel SIM Card" placeholderTextColor={T.sub} />

                  <Text style={s.lbl}>Farashi (₦)</Text>
                  <View style={{ flexDirection: "row" }}>
                    <View style={s.prefix}>
                      <Text style={s.prefixTxt}>₦</Text>
                    </View>
                    <TextInput
                      style={[s.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]}
                      value={editPrice} onChangeText={setEditPrice}
                      keyboardType="numeric" placeholder="e.g. 3000" placeholderTextColor={T.sub}
                    />
                  </View>

                  <Text style={s.lbl}>Bayani (Description)</Text>
                  <TextInput
                    style={[s.input, { height: 70, textAlignVertical: "top", paddingTop: 10 }]}
                    value={editDesc} onChangeText={setEditDesc}
                    placeholder="Short description..." placeholderTextColor={T.sub} multiline
                  />

                  <Text style={s.lbl}>Yanayi (Status)</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[s.stBtn, editStatus === "on" && s.stBtnOn]}
                      onPress={() => setEditStatus("on")} activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={editStatus === "on" ? "#fff" : T.green} />
                      <Text style={[s.stBtnTxt, editStatus === "on" && { color: "#fff" }]}>Active</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.stBtn, editStatus === "off" && s.stBtnOff, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                      onPress={() => setEditStatus("off")} activeOpacity={0.8}
                    >
                      <Ionicons name="eye-off" size={18} color={editStatus === "off" ? "#fff" : T.red} />
                      <Text style={[s.stBtnTxt, editStatus === "off" && { color: "#fff" }]}>Hidden</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Preview */}
                  <View style={s.preview}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: T.sub, marginBottom: 8 }}>👀 Preview</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: T.border }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: T.text }}>{editName || "SIM Name"}</Text>
                      <Text style={{ fontSize: 17, fontWeight: "900", color: T.navy }}>₦{Number(editPrice || 0).toLocaleString()}</Text>
                    </View>
                  </View>

                  <TouchableOpacity onPress={savePlan} style={[s.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.85} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={s.saveTxt}>Ajiye Canje-canje</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", paddingTop: Platform.OS === "ios" ? 56 : 44, paddingBottom: 16, paddingHorizontal: 16 },
  iconBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  toast:       { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12 },
  toastTxt:    { color: "#fff", fontSize: 12, fontWeight: "700", flex: 1 },
  statsBar:    { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1.5, borderColor: "#e2e8f0", overflow: "hidden", elevation: 2 },
  statItem:    { flex: 1, alignItems: "center", paddingVertical: 12 },
  statDiv:     { borderLeftWidth: 1, borderLeftColor: "#e2e8f0" },
  statVal:     { fontSize: 17, fontWeight: "900" },
  statLbl:     { fontSize: 9.5, color: "#64748b", fontWeight: "600", marginTop: 2 },
  sectionLbl:  { fontSize: 12, fontWeight: "800", color: "#0d1b3e", marginBottom: 12, letterSpacing: 0.4 },
  card:        { backgroundColor: "#fff", borderRadius: 18, marginBottom: 14, borderWidth: 1.5, borderColor: "#e2e8f0", flexDirection: "row", overflow: "hidden", elevation: 2 },
  cardStripe:  { width: 5 },
  cardBody:    { flex: 1, padding: 14 },
  cardTop:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  logoBox:     { width: 52, height: 52, borderRadius: 14, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", borderWidth: 1.5, overflow: "hidden" },
  logo:        { width: "80%", height: "80%" },
  cardName:    { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardDesc:    { fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 16 },
  netBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  netBadgeTxt: { fontSize: 9, fontWeight: "800" },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, gap: 4 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  dotTxt:      { fontSize: 9, fontWeight: "800" },
  priceRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10 },
  priceLbl:    { fontSize: 10, color: "#64748b", fontWeight: "600" },
  priceVal:    { fontSize: 20, fontWeight: "900", marginTop: 2 },
  actBtns:     { flexDirection: "row", gap: 8 },
  actBtn:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, gap: 5 },
  actBtnTxt:   { fontSize: 12, fontWeight: "700" },
  idTxt:       { fontSize: 9.5, color: "#94A3B8", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  infoBox:     { flexDirection: "row", backgroundColor: "#EFF6FF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#BFDBFE", marginTop: 8 },
  infoTxt:     { flex: 1, fontSize: 11.5, color: "#1D4ED8", lineHeight: 17 },
  overlay:     { flex: 1, backgroundColor: "rgba(10,17,40,0.7)", justifyContent: "flex-end" },
  modalBox:    { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", overflow: "hidden" },
  modalHead:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  modalTitle:  { fontSize: 17, fontWeight: "900", color: "#fff" },
  modalSub:    { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  modalBody:   { padding: 20 },
  netBadgeBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  netBadgeBig: { fontSize: 13, fontWeight: "800" },
  netBadgeSub: { fontSize: 10, color: "#64748b", marginTop: 2 },
  lbl:         { fontSize: 12, fontWeight: "700", color: "#0d1b3e", marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#0f172a", fontWeight: "600" },
  prefix:      { backgroundColor: "#0d1b3e", borderRadius: 12, borderTopRightRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  prefixTxt:   { fontSize: 16, fontWeight: "900", color: "#f5a623" },
  stBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, backgroundColor: "#F0FDF4", borderWidth: 1.5, borderColor: "#BBF7D0", gap: 6 },
  stBtnOn:     { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stBtnOff:    { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  stBtnTxt:    { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  preview:     { marginTop: 20, padding: 14, backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1.5, borderColor: "#e2e8f0" },
  saveBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b3e", borderRadius: 16, paddingVertical: 15, marginTop: 20, marginBottom: 30 },
  saveTxt:     { color: "#fff", fontSize: 15, fontWeight: "900" },
});
