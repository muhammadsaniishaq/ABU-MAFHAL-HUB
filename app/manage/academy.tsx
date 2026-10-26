import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, RefreshControl,
    Alert, ActivityIndicator, StyleSheet, Platform, TextInput, Modal, Linking
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

// Executive Royal Light Palette (Consistent with Brand)
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    navySub: '#1E293B',
    gold: '#D97706',
    goldLight: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#059669',
    emeraldLight: '#D1FAE5',
    emeraldBorder: '#A7F3D0',
    blue: '#2563EB',
    blueLight: '#DBEAFE',
    purple: '#7C3AED',
    purpleLight: '#EDE9FE',
    red: '#DC2626',
    redLight: '#FEE2E2',
    border: '#E2E8F0',
    textMuted: '#64748B',
    textDim: '#94A3B8',
};

interface CourseModule {
    id: string;
    title: string;
    category: 'compliance' | 'support' | 'operations' | 'security' | 'vtu_scaling';
    duration: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    description: string;
    content?: string;
    videoUrl?: string;
    docUrl?: string;
    rewardXp: number;
    badgeName: string;
    isMandatory: boolean;
    status: 'published' | 'draft';
    createdAt: string;
    author?: string;
}

// 100% Genuine, Custom Brand Modules for Abu Mafhal Sub
const INITIAL_COURSES: CourseModule[] = [
    {
        id: 'abumafhal-vtu-01',
        title: 'Abu Mafhal Sub VTU Operations & Server Failover',
        category: 'vtu_scaling',
        duration: '35 mins',
        level: 'Intermediate',
        description: 'Yadda tsarin aika Data da Airtime yake aiki ta atomatik a Abu Mafhal Sub, canza API provider idan MTN/Airtel/Glo suka samu matsala, da tabbatar da cewa kowane transaction ya tafi cikin daƙiƙa 5.',
        content: `Cikakken tsarin aikin Abu Mafhal Sub VTU Gateway:\n\n1. Ingestion: Da zarar mai amfani ya sayi Data, tsarin yana duba walat dinsa.\n2. Routing: Idan MTN SME ya tsaya, router ɗin yana maida request ɗin zuwa MTN Corporate Gifting kai tsaye.\n3. Automatic Reconciliation: Duk kuɗin da aka cire ba a samu sakamako ba yana dawowa cikin walat take.\n4. Admin Overrides: Admin na iya dakatar da network da ke da matsala daga Settings.`,
        docUrl: 'https://abumafhal.com.ng',
        rewardXp: 200,
        badgeName: 'Abu Mafhal Operations Specialist',
        isMandatory: true,
        status: 'published',
        createdAt: '2026-02-01T10:00:00.000Z',
        author: 'Abu Mafhal Core Team'
    },
    {
        id: 'abumafhal-dispute-02',
        title: 'Customer Dispute Resolution & Instant Refund Protocol',
        category: 'support',
        duration: '40 mins',
        level: 'Beginner',
        description: 'Ka’idojin kula da abokan hulɗa: yadda ake magance korafe-korafen debits, tabbatar da payment status, da kuma bayar da tallafi ta WhatsApp da live chat.',
        content: `Matakan magance matsalar abokin ciniki:\n\n1. Duba Transaction ID a shafin Management Transactions.\n2. Idan status ɗin 'FAILED' ne amma an cire kuɗi, danna 'Trigger Refund' kai tsaye zuwa Main Wallet.\n3. Idan 'PENDING' ne a wurin network provider, danna 'Query Provider Status'.\n4. Tura wa mai amfani sakon sanarwa (In-App Notification) don nuna an warware matsalar.`,
        docUrl: 'https://abumafhal.com.ng',
        rewardXp: 150,
        badgeName: 'Certified Support Lead',
        isMandatory: true,
        status: 'published',
        createdAt: '2026-02-05T12:00:00.000Z',
        author: 'Abu Mafhal Support HQ'
    },
    {
        id: 'abumafhal-cbn-aml-03',
        title: 'CBN & NDPR Compliance for Abu Mafhal Tier-3 Accounts',
        category: 'compliance',
        duration: '50 mins',
        level: 'Advanced',
        description: 'Tabbatar da BVN/NIN verification da bin dokokin Babban Bankin Najeriya (CBN) kan Virtual Accounts (Wema Bank, PalmPay, Moniepoint) da kariya ga bayanan sirri na NDPR.',
        content: `Sharuɗɗan CBN da NDPR a Abu Mafhal Sub:\n\n1. Tier-1 KYC: Rajista da lambar waya da email (iyaka: ₦50,000 a rana).\n2. Tier-3 KYC: Tabbatar da NIN/BVN don buɗe Dedicated Virtual Account mai karbar har zuwa ₦5,000,000.\n3. Anti-Money Laundering (AML): Dakatar da duk asusun da ke nuna alamar zamba ko suspicious velocity transfers.\n4. Privacy: Kada a nuna bayanan NIN a fili ga kowa sai authorized admin.`,
        docUrl: 'https://cbn.gov.ng',
        rewardXp: 250,
        badgeName: 'AML Compliance Officer',
        isMandatory: true,
        status: 'published',
        createdAt: '2026-02-10T14:00:00.000Z',
        author: 'Abu Mafhal Legal & Security'
    },
    {
        id: 'abumafhal-reseller-04',
        title: 'Reseller Growth & Agent Portal Management',
        category: 'vtu_scaling',
        duration: '45 mins',
        level: 'Advanced',
        description: "Yadda ake sarrafa discounts na musamman ga 'Resellers' da 'API Partners', saita farashin VIP, da haɓaka hanyoyin samun kudin shiga na kasuwanci.",
        content: `Dabarun bunkasa kasuwancin Resellers:\n\n1. Upgrade ga masu amfani zuwa 'Agent' ko 'Vendor' tare da sauƙin farashin Data (e.g. MTN 1GB a sauki).\n2. Bayar da API Documentation ga developers masu amfani da shafukan kansu.\n3. Binciken riba da fitar da rahoton lissafi na mako-mako da wata-wata.`,
        docUrl: 'https://abumafhal.com.ng',
        rewardXp: 180,
        badgeName: 'Master Reseller Consultant',
        isMandatory: false,
        status: 'published',
        createdAt: '2026-02-15T09:00:00.000Z',
        author: 'Abu Mafhal Growth Team'
    }
];

export default function AdminAcademyScreen() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'courses' | 'progress' | 'certificates'>('courses');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<CourseModule[]>(INITIAL_COURSES);
    const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
    const [adminXp, setAdminXp] = useState<number>(350);

    // Modal State for New Course Creation & Editing
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [savingCourse, setSavingCourse] = useState(false);

    // Form inputs
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<CourseModule['category']>('compliance');
    const [newDuration, setNewDuration] = useState('45 mins');
    const [newLevel, setNewLevel] = useState<CourseModule['level']>('Beginner');
    const [newDesc, setNewDesc] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newDocUrl, setNewDocUrl] = useState('');
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [newBadge, setNewBadge] = useState('Certified Specialist');
    const [newXp, setNewXp] = useState('150');
    const [newMandatory, setNewMandatory] = useState(true);

    // Active Study Modal
    const [studyingCourse, setStudyingCourse] = useState<CourseModule | null>(null);

    // Filter
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Fetch persisted courses from Supabase app_settings
    const loadAcademyData = useCallback(async () => {
        try {
            const { data: settingsRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_academy_courses')
                .maybeSingle();

            if (settingsRow?.value && Array.isArray(settingsRow.value) && settingsRow.value.length > 0) {
                setCourses(settingsRow.value);
            } else {
                // If not in database yet, persist the real custom Abu Mafhal modules
                setCourses(INITIAL_COURSES);
                await supabase.from('app_settings').upsert({
                    key: 'admin_academy_courses',
                    value: INITIAL_COURSES
                });
            }

            // Fetch progress for current user
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: progressRow } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', `academy_progress_${user.id}`)
                    .maybeSingle();

                if (progressRow?.value) {
                    setUserProgress(progressRow.value.completedCourses || {});
                    setAdminXp(Number(progressRow.value.xp || 350));
                }
            }
        } catch (err) {
            console.warn('Load academy data notice:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAcademyData();
    }, [loadAcademyData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAcademyData();
    };

    // Toggle Course Completion
    const handleToggleComplete = async (courseId: string, xpReward: number) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const isDone = !!userProgress[courseId];
            const updated = { ...userProgress, [courseId]: !isDone };
            const newTotalXp = isDone ? Math.max(0, adminXp - xpReward) : adminXp + xpReward;

            setUserProgress(updated);
            setAdminXp(newTotalXp);

            await supabase.from('app_settings').upsert({
                key: `academy_progress_${user.id}`,
                value: {
                    userId: user.id,
                    completedCourses: updated,
                    xp: newTotalXp,
                    updatedAt: new Date().toISOString()
                }
            });

            if (!isDone) {
                Alert.alert('Masha Allah! 🎓', `Ka kammala wannan darasi! Ka sami ƙarin +${xpReward} Staff XP.`);
            }
        } catch (err: any) {
            Alert.alert('Notice', err.message || 'Could not update progress.');
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (course: CourseModule) => {
        setEditingCourseId(course.id);
        setNewTitle(course.title);
        setNewCategory(course.category);
        setNewDuration(course.duration);
        setNewLevel(course.level);
        setNewDesc(course.description);
        setNewContent(course.content || '');
        setNewDocUrl(course.docUrl || '');
        setNewVideoUrl(course.videoUrl || '');
        setNewBadge(course.badgeName);
        setNewXp(String(course.rewardXp));
        setNewMandatory(course.isMandatory);
        setShowCreateModal(true);
    };

    // Delete Course
    const handleDeleteCourse = (courseId: string) => {
        Alert.alert(
            "Goge Darasi",
            "Kana da tabbacin kana son goge wannan darasin daga tsarin koyon Abu Mafhal Sub?",
            [
                { text: "A'a", style: "cancel" },
                {
                    text: "Goge",
                    style: "destructive",
                    onPress: async () => {
                        const updated = courses.filter(c => c.id !== courseId);
                        setCourses(updated);
                        await supabase.from('app_settings').upsert({
                            key: 'admin_academy_courses',
                            value: updated
                        });
                        Alert.alert("An Goge", "An cire darasin cikin nasara.");
                    }
                }
            ]
        );
    };

    // Save or Update Course
    const handleSaveCourse = async () => {
        if (!newTitle.trim()) {
            Alert.alert('Ana bukata', 'Da fatan za a rubuta taken darasi.');
            return;
        }

        setSavingCourse(true);
        try {
            let updatedList: CourseModule[] = [];

            if (editingCourseId) {
                // Update existing
                updatedList = courses.map(c => {
                    if (c.id === editingCourseId) {
                        return {
                            ...c,
                            title: newTitle.trim(),
                            category: newCategory,
                            duration: newDuration.trim() || '30 mins',
                            level: newLevel,
                            description: newDesc.trim() || 'Darasin horon ma’aikata da agents.',
                            content: newContent.trim() || undefined,
                            docUrl: newDocUrl.trim() || undefined,
                            videoUrl: newVideoUrl.trim() || undefined,
                            rewardXp: Number(newXp) || 100,
                            badgeName: newBadge.trim() || 'Certified Specialist',
                            isMandatory: newMandatory,
                        };
                    }
                    return c;
                });
            } else {
                // Create new
                const newCourseItem: CourseModule = {
                    id: `abumafhal-course-${Date.now()}`,
                    title: newTitle.trim(),
                    category: newCategory,
                    duration: newDuration.trim() || '30 mins',
                    level: newLevel,
                    description: newDesc.trim() || 'Darasin horon ma’aikata da agents.',
                    content: newContent.trim() || undefined,
                    docUrl: newDocUrl.trim() || undefined,
                    videoUrl: newVideoUrl.trim() || undefined,
                    rewardXp: Number(newXp) || 100,
                    badgeName: newBadge.trim() || 'Certified Specialist',
                    isMandatory: newMandatory,
                    status: 'published',
                    createdAt: new Date().toISOString(),
                    author: 'Abu Mafhal Admin'
                };
                updatedList = [newCourseItem, ...courses];
            }

            setCourses(updatedList);

            await supabase.from('app_settings').upsert({
                key: 'admin_academy_courses',
                value: updatedList
            });

            setShowCreateModal(false);
            setEditingCourseId(null);
            setNewTitle('');
            setNewDesc('');
            setNewContent('');
            setNewDocUrl('');
            setNewVideoUrl('');
            Alert.alert('Nasarar 🚀', editingCourseId ? 'An sabunta bayanan darasin!' : 'An wallafa sabon darasin cikin nasara!');
        } catch (err: any) {
            Alert.alert('Kuskure', err.message || 'An samu matsala wajen adanawa.');
        } finally {
            setSavingCourse(false);
        }
    };

    // Filter courses
    const filteredCourses = selectedCategory === 'all'
        ? courses
        : courses.filter(c => c.category === selectedCategory);

    const completedCount = courses.filter(c => userProgress[c.id]).length;
    const completionPercent = courses.length > 0 ? Math.round((completedCount / courses.length) * 100) : 0;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Abu Mafhal Academy Hub',
                    headerStyle: { backgroundColor: C.navy },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontWeight: '800', fontSize: 16 },
                    headerShadowVisible: false,
                }}
            />

            {/* Sub-Header Tabs */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('courses')}
                    style={[styles.tabBtn, activeTab === 'courses' && styles.tabBtnActive]}
                >
                    <Ionicons name="book-outline" size={16} color={activeTab === 'courses' ? C.navy : C.textMuted} />
                    <Text style={[styles.tabBtnText, activeTab === 'courses' && styles.tabBtnTextActive]}>Darussa (Curriculum)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('progress')}
                    style={[styles.tabBtn, activeTab === 'progress' && styles.tabBtnActive]}
                >
                    <Ionicons name="stats-chart-outline" size={16} color={activeTab === 'progress' ? C.navy : C.textMuted} />
                    <Text style={[styles.tabBtnText, activeTab === 'progress' && styles.tabBtnTextActive]}>Ci Gaban Ma'aikata</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('certificates')}
                    style={[styles.tabBtn, activeTab === 'certificates' && styles.tabBtnActive]}
                >
                    <Ionicons name="ribbon-outline" size={16} color={activeTab === 'certificates' ? C.navy : C.textMuted} />
                    <Text style={[styles.tabBtnText, activeTab === 'certificates' && styles.tabBtnTextActive]}>Satifiket & Yabo</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.gold]} />}
            >
                {/* Executive Progress Card */}
                <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.heroCard}>
                    <View style={styles.heroRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.badgePill}>
                                <Ionicons name="shield-checkmark" size={12} color="#FDE68A" />
                                <Text style={styles.badgePillText}>ABU MAFHAL OFFICIAL ACADEMY</Text>
                            </View>
                            <Text style={styles.heroTitle}>Matakin Admin & Super Agents</Text>
                            <Text style={styles.heroSub}>Cikakken tsarin horo da kwarewa na gaskiya da aka sanya don Abu Mafhal Sub</Text>
                        </View>
                        <View style={styles.iconCircleHero}>
                            <Ionicons name="school" size={26} color="#F59E0B" />
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(12, completionPercent))}%` }]} />
                    </View>

                    <View style={styles.heroFooter}>
                        <Text style={styles.heroFooterText}>
                            {completedCount} daga cikin {courses.length} Darussa An Kammala ({completionPercent}%)
                        </Text>
                        <Text style={styles.xpText}>{adminXp} Staff XP ⭐</Text>
                    </View>
                </LinearGradient>

                {/* TAB 1: CURRICULUM */}
                {activeTab === 'courses' && (
                    <View>
                        {/* Action Bar: Create Course + Category Pills */}
                        <View style={styles.actionBar}>
                            <Text style={styles.sectionHeaderTitle}>DARUSSAN HORON KASUWANCI</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setEditingCourseId(null);
                                    setNewTitle('');
                                    setNewDesc('');
                                    setNewContent('');
                                    setNewDocUrl('');
                                    setNewVideoUrl('');
                                    setShowCreateModal(true);
                                }}
                                style={styles.addCourseBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                                <Text style={styles.addCourseBtnText}>Sanya Sabon Darasi</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Category Selector */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {[
                                { id: 'all', label: 'Duk Darussa' },
                                { id: 'vtu_scaling', label: 'VTU & Sabar' },
                                { id: 'support', label: 'Customer Care' },
                                { id: 'compliance', label: 'CBN & Dokoki' },
                                { id: 'security', label: 'Tsaron API' },
                            ].map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    style={[
                                        styles.catPill,
                                        selectedCategory === cat.id && styles.catPillActive
                                    ]}
                                >
                                    <Text style={[
                                        styles.catPillText,
                                        selectedCategory === cat.id && styles.catPillTextActive
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Course List */}
                        {loading ? (
                            <ActivityIndicator size="large" color={C.gold} style={{ marginVertical: 32 }} />
                        ) : filteredCourses.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="school-outline" size={42} color={C.textDim} />
                                <Text style={styles.emptyTitle}>Babu darasi a wannan ɓangaren</Text>
                                <Text style={styles.emptySub}>Danna 'Sanya Sabon Darasi' don ƙara darasi a wannan ɓangaren.</Text>
                            </View>
                        ) : (
                            filteredCourses.map(course => {
                                const isCompleted = !!userProgress[course.id];
                                return (
                                    <View key={course.id} style={styles.courseCard}>
                                        <View style={styles.courseCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    {course.isMandatory && (
                                                        <View style={styles.mandPill}>
                                                            <Text style={styles.mandPillText}>DOLE NE</Text>
                                                        </View>
                                                    )}
                                                    <View style={[styles.levelPill, { backgroundColor: course.level === 'Advanced' ? C.purpleLight : C.blueLight }]}>
                                                        <Text style={[styles.levelPillText, { color: course.level === 'Advanced' ? C.purple : C.blue }]}>
                                                            {course.level}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.durationText}>⏱️ {course.duration}</Text>
                                                    {course.author && (
                                                        <Text style={styles.authorBadge}>• {course.author}</Text>
                                                    )}
                                                </View>
                                                <Text style={styles.courseTitle}>{course.title}</Text>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => handleToggleComplete(course.id, course.rewardXp)}
                                                style={styles.checkBtn}
                                            >
                                                <Ionicons
                                                    name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                                                    size={24}
                                                    color={isCompleted ? C.emerald : C.textDim}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.courseDesc}>{course.description}</Text>

                                        {/* Action buttons */}
                                        <View style={styles.courseFooter}>
                                            <View style={styles.rewardBox}>
                                                <Ionicons name="star" size={13} color={C.gold} />
                                                <Text style={styles.rewardText}>+{course.rewardXp} XP</Text>
                                                <Text style={styles.badgeNameText}>• {course.badgeName}</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                {/* In-App Study Lesson */}
                                                <TouchableOpacity
                                                    onPress={() => setStudyingCourse(course)}
                                                    style={styles.linkActionBtn}
                                                >
                                                    <Ionicons name="book-outline" size={12} color={C.emerald} />
                                                    <Text style={[styles.linkActionText, { color: C.emerald }]}>Karanta Darasi</Text>
                                                </TouchableOpacity>

                                                {/* Edit Button */}
                                                <TouchableOpacity
                                                    onPress={() => handleOpenEdit(course)}
                                                    style={[styles.linkActionBtn, { backgroundColor: '#F1F5F9', borderColor: C.border }]}
                                                >
                                                    <Ionicons name="create-outline" size={13} color={C.navy} />
                                                </TouchableOpacity>

                                                {/* Delete Button */}
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteCourse(course.id)}
                                                    style={[styles.linkActionBtn, { backgroundColor: C.redLight, borderColor: '#FECACA' }]}
                                                >
                                                    <Ionicons name="trash-outline" size={13} color={C.red} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* TAB 2: STAFF PROGRESS */}
                {activeTab === 'progress' && (
                    <View>
                        <Text style={styles.sectionHeaderTitle}>MATAKIN KWAREWAR MA'AIKATA</Text>
                        <Text style={styles.sectionHeaderSub}>
                            Tsarin tabbatar da kwarewar staff da super agents wajen gudanar da VTU da sabis na Abu Mafhal Sub.
                        </Text>

                        <View style={styles.statGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>{courses.length}</Text>
                                <Text style={styles.statLbl}>Jimillar Darussa</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={[styles.statVal, { color: C.emerald }]}>{completedCount}</Text>
                                <Text style={styles.statLbl}>An Kammala</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={[styles.statVal, { color: C.gold }]}>{adminXp}</Text>
                                <Text style={styles.statLbl}>Staff XP</Text>
                            </View>
                        </View>

                        <View style={styles.staffCard}>
                            <Text style={styles.staffCardTitle}>Sharuɗɗan Gudanarwa na Abu Mafhal Sub</Text>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>Bukatun CBN: Tabbatar da NIN/BVN ga duk asusun da ke cinikayyar sama da ₦50,000.</Text>
                            </View>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>Saurin Taimako: Warware duk korafin debit da mayar da kuɗi a cikin mintuna 15.</Text>
                            </View>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>Tsaron Sabar: Duba webhook security da kuma kiyaye asusun sirri na masu amfani.</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* TAB 3: CERTIFICATIONS */}
                {activeTab === 'certificates' && (
                    <View>
                        <Text style={styles.sectionHeaderTitle}>LAMBOBIN YABO DA SATIFIKET</Text>
                        <Text style={styles.sectionHeaderSub}>
                            Satifiket na hukuma na Abu Mafhal Sub da ake bayarwa bayan an kammala darussan horon.
                        </Text>

                        <View style={styles.certGrid}>
                            {courses.map(course => {
                                const isEarned = !!userProgress[course.id];
                                return (
                                    <View
                                        key={course.id}
                                        style={[
                                            styles.certCard,
                                            isEarned ? styles.certCardEarned : styles.certCardLocked
                                        ]}
                                    >
                                        <View style={[styles.certRibbon, { backgroundColor: isEarned ? C.gold : '#E2E8F0' }]}>
                                            <Ionicons
                                                name={isEarned ? "ribbon" : "lock-closed"}
                                                size={30}
                                                color={isEarned ? "#FFFFFF" : C.textDim}
                                            />
                                        </View>
                                        <Text style={styles.certName}>{course.badgeName}</Text>
                                        <Text style={styles.certTrack}>{course.title}</Text>
                                        <View style={[styles.certStatusPill, isEarned ? { backgroundColor: C.emeraldLight } : { backgroundColor: '#F1F5F9' }]}>
                                            <Text style={[styles.certStatusText, { color: isEarned ? C.emerald : C.textDim }]}>
                                                {isEarned ? 'AN SAMU (VERIFIED)' : 'A RUFE YAKE'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* STUDY LESSON MODAL (100% In-App Reading) */}
            <Modal visible={!!studyingCourse} animationType="slide" transparent onRequestClose={() => setStudyingCourse(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.modalTitle}>{studyingCourse?.title}</Text>
                                <Text style={styles.authorBadge}>Mawallafi: {studyingCourse?.author || 'Abu Mafhal Sub HQ'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setStudyingCourse(null)}>
                                <Ionicons name="close-circle" size={26} color={C.navy} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ marginVertical: 10 }}>
                            <Text style={styles.studyDesc}>{studyingCourse?.description}</Text>

                            <View style={styles.lessonContentBox}>
                                <Text style={styles.lessonSectionTitle}>Takardar Koyarwa & Ka'idoji:</Text>
                                <Text style={styles.lessonText}>
                                    {studyingCourse?.content || 'Babu cikakken rubutu a wannan darasin. Da fatan za a bincika takaddar da ke kasa ko bidiyo.'}
                                </Text>
                            </View>

                            {studyingCourse?.docUrl && (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(studyingCourse.docUrl!)}
                                    style={[styles.linkActionBtn, { paddingVertical: 10, marginBottom: 8, justifyContent: 'center' }]}
                                >
                                    <Ionicons name="open-outline" size={16} color={C.blue} />
                                    <Text style={[styles.linkActionText, { color: C.blue, fontSize: 12 }]}>Buɗe Takardar Waje (External Document)</Text>
                                </TouchableOpacity>
                            )}

                            {studyingCourse?.videoUrl && (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(studyingCourse.videoUrl!)}
                                    style={[styles.linkActionBtn, { backgroundColor: C.redLight, borderColor: '#FECACA', paddingVertical: 10, justifyContent: 'center' }]}
                                >
                                    <Ionicons name="logo-youtube" size={16} color={C.red} />
                                    <Text style={[styles.linkActionText, { color: C.red, fontSize: 12 }]}>Kalli Bidiyon Horon (Watch Video)</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => {
                                if (studyingCourse) {
                                    handleToggleComplete(studyingCourse.id, studyingCourse.rewardXp);
                                }
                                setStudyingCourse(null);
                            }}
                            style={styles.saveBtn}
                        >
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.saveBtnText}>Na Karanta Kuma Na Fahimta (+{studyingCourse?.rewardXp} XP)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* CREATE / EDIT COURSE MODAL */}
            <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingCourseId ? 'Gyara Bayanan Darasi' : 'Sanya Sabon Darasin Horo'}</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={24} color={C.navy} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }}>
                            <Text style={styles.inputLabel}>Taken Darasi *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Misali: Tsarin Bada Data & Airtime"
                                placeholderTextColor={C.textDim}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={styles.inputLabel}>Bangare (Category)</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {(['vtu_scaling', 'support', 'compliance', 'security'] as const).map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setNewCategory(cat)}
                                        style={[styles.smallPill, newCategory === cat && styles.smallPillActive]}
                                    >
                                        <Text style={[styles.smallPillText, newCategory === cat && styles.smallPillTextActive]}>
                                            {cat === 'vtu_scaling' ? 'VTU & SABAR' : cat === 'support' ? 'SUPPORT' : cat === 'compliance' ? 'CBN DOKOKI' : 'TSARON API'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Lokacin Karatu</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. 35 mins"
                                        placeholderTextColor={C.textDim}
                                        value={newDuration}
                                        onChangeText={setNewDuration}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Ladar XP</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="150"
                                        placeholderTextColor={C.textDim}
                                        keyboardType="numeric"
                                        value={newXp}
                                        onChangeText={setNewXp}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Sunan Lambar Yabo (Badge Title)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Misali: Abu Mafhal Support Master"
                                placeholderTextColor={C.textDim}
                                value={newBadge}
                                onChangeText={setNewBadge}
                            />

                            <Text style={styles.inputLabel}>Takaitaccen Bayani (Description)</Text>
                            <TextInput
                                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                                placeholder="Takaitaccen abin da darasin ya qunsa..."
                                placeholderTextColor={C.textDim}
                                multiline
                                value={newDesc}
                                onChangeText={setNewDesc}
                            />

                            <Text style={styles.inputLabel}>Cikakken Rubutun Darasin (Lesson Content)</Text>
                            <TextInput
                                style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                                placeholder="Rubuta cikakken bayanin darasin da ma'aikata ko agents zasu karanta a cikin manhaja..."
                                placeholderTextColor={C.textDim}
                                multiline
                                value={newContent}
                                onChangeText={setNewContent}
                            />

                            <Text style={styles.inputLabel}>Link ɗin Takarda / Shafi (Website Link)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="https://abumafhal.com.ng..."
                                placeholderTextColor={C.textDim}
                                autoCapitalize="none"
                                value={newDocUrl}
                                onChangeText={setNewDocUrl}
                            />

                            <Text style={styles.inputLabel}>Link ɗin Bidiyon YouTube (Video URL)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="https://youtube.com/..."
                                placeholderTextColor={C.textDim}
                                autoCapitalize="none"
                                value={newVideoUrl}
                                onChangeText={setNewVideoUrl}
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowCreateModal(false)}
                                style={styles.cancelBtn}
                            >
                                <Text style={styles.cancelBtnText}>Soke</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveCourse}
                                style={styles.saveBtn}
                                disabled={savingCourse}
                            >
                                {savingCourse ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>{editingCourseId ? 'Ajiye Gyara 💾' : 'Wallafa Darasi 🚀'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingHorizontal: 8,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabBtnActive: {
        borderBottomColor: C.gold,
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textMuted,
    },
    tabBtnTextActive: {
        color: C.navy,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.3)',
    },
    heroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 119, 6, 0.25)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
    },
    badgePillText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#FDE68A',
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    heroSub: {
        fontSize: 11.5,
        color: '#94A3B8',
        lineHeight: 16,
    },
    iconCircleHero: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressTrack: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 4,
        marginVertical: 14,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#F59E0B',
        borderRadius: 4,
    },
    heroFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroFooterText: {
        fontSize: 11,
        color: '#CBD5E1',
        fontWeight: '600',
    },
    xpText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FDE68A',
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionHeaderTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: 0.5,
    },
    sectionHeaderSub: {
        fontSize: 12,
        color: C.textMuted,
        marginBottom: 14,
        lineHeight: 17,
    },
    addCourseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.navy,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    addCourseBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    catScroll: {
        marginBottom: 14,
    },
    catPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        marginRight: 8,
    },
    catPillActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    catPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.textMuted,
    },
    catPillTextActive: {
        color: '#FFFFFF',
    },
    courseCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    courseCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    mandPill: {
        backgroundColor: C.redLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    mandPillText: {
        fontSize: 9,
        fontWeight: '900',
        color: C.red,
    },
    levelPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    levelPillText: {
        fontSize: 9,
        fontWeight: '800',
    },
    durationText: {
        fontSize: 10.5,
        color: C.textMuted,
    },
    authorBadge: {
        fontSize: 10,
        color: C.gold,
        fontWeight: '700',
    },
    courseTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: C.navy,
        marginTop: 2,
    },
    checkBtn: {
        padding: 4,
    },
    courseDesc: {
        fontSize: 12,
        color: C.textMuted,
        lineHeight: 17,
        marginVertical: 8,
    },
    courseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    rewardBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rewardText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.gold,
    },
    badgeNameText: {
        fontSize: 11,
        color: C.textMuted,
    },
    linkActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.emeraldLight,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    linkActionText: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    emptyCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
        marginTop: 8,
    },
    emptySub: {
        fontSize: 11.5,
        color: C.textMuted,
        textAlign: 'center',
        marginTop: 2,
    },
    statGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        backgroundColor: C.card,
        padding: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    statVal: {
        fontSize: 20,
        fontWeight: '900',
        color: C.navy,
    },
    statLbl: {
        fontSize: 10.5,
        fontWeight: '600',
        color: C.textMuted,
        marginTop: 2,
    },
    staffCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
    },
    staffCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 12,
    },
    directiveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    directiveText: {
        flex: 1,
        fontSize: 12,
        color: C.navySub,
        lineHeight: 17,
    },
    certGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    certCard: {
        width: '48%',
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    certCardEarned: {
        borderColor: C.goldBorder,
    },
    certCardLocked: {
        borderColor: C.border,
        opacity: 0.65,
    },
    certRibbon: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    certName: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy,
        textAlign: 'center',
        marginBottom: 2,
    },
    certTrack: {
        fontSize: 10,
        color: C.textMuted,
        textAlign: 'center',
        marginBottom: 10,
    },
    certStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    certStatusText: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        padding: 18,
    },
    modalBox: {
        backgroundColor: C.card,
        borderRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: C.navy,
    },
    inputLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.textMuted,
        marginBottom: 4,
        marginTop: 8,
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 12.5,
        color: C.navy,
    },
    smallPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.border,
    },
    smallPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    smallPillText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: C.textMuted,
    },
    smallPillTextActive: {
        color: '#FFFFFF',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: C.textMuted,
    },
    saveBtn: {
        flex: 2,
        backgroundColor: C.gold,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    saveBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    studyDesc: {
        fontSize: 12.5,
        color: C.textMuted,
        lineHeight: 18,
        marginBottom: 12,
    },
    lessonContentBox: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    lessonSectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 8,
    },
    lessonText: {
        fontSize: 12,
        color: C.navySub,
        lineHeight: 19,
    },
});
