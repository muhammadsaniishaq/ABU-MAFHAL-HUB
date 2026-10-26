import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, RefreshControl,
    Alert, ActivityIndicator, StyleSheet, Platform, TextInput, Modal, Linking
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

// Executive Royal Light Palette (Brand Aligned)
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
    videoUrl?: string;
    docUrl?: string;
    rewardXp: number;
    badgeName: string;
    isMandatory: boolean;
    status: 'published' | 'draft';
    createdAt: string;
}

const DEFAULT_COURSES: CourseModule[] = [
    {
        id: 'cbn-aml-01',
        title: 'CBN AML/CFT & Tier 3 Compliance',
        category: 'compliance',
        duration: '45 mins',
        level: 'Intermediate',
        description: 'Comprehensive guidelines on Anti-Money Laundering (AML), Combating Financing of Terrorism (CFT), and Tier-3 KYC verification required by the Central Bank of Nigeria.',
        docUrl: 'https://cbn.gov.ng',
        rewardXp: 150,
        badgeName: 'AML Certified Officer',
        isMandatory: true,
        status: 'published',
        createdAt: '2026-01-10T10:00:00.000Z',
    },
    {
        id: 'vtu-scaling-02',
        title: 'VTU Business Growth & High-Volume Scaling',
        category: 'vtu_scaling',
        duration: '1 hr 15 mins',
        level: 'Advanced',
        description: 'Masterclass on managing liquidity, multi-provider API failovers, daily reconciliation, and reseller network acquisition strategies.',
        videoUrl: 'https://youtube.com',
        rewardXp: 250,
        badgeName: 'VTU Growth Specialist',
        isMandatory: false,
        status: 'published',
        createdAt: '2026-01-15T12:00:00.000Z',
    },
    {
        id: 'support-disputes-03',
        title: 'Customer Dispute & Chargeback Protocol',
        category: 'support',
        duration: '50 mins',
        level: 'Beginner',
        description: 'Step-by-step resolution of pending airtime/data tokens, uncredited wallet debits, and fraud prevention protocols.',
        docUrl: 'https://abumafhal.com.ng',
        rewardXp: 120,
        badgeName: 'Master Support Agent',
        isMandatory: true,
        status: 'published',
        createdAt: '2026-02-01T09:00:00.000Z',
    },
    {
        id: 'sec-webhook-04',
        title: 'API Security & Webhook Signatures',
        category: 'security',
        duration: '40 mins',
        level: 'Advanced',
        description: 'Securing VTU partner integrations: HMAC-SHA256 hash validation, replay attack mitigation, and IP whitelisting.',
        docUrl: 'https://docs.abumafhal.com.ng',
        rewardXp: 200,
        badgeName: 'Security Champion',
        isMandatory: false,
        status: 'published',
        createdAt: '2026-02-12T14:30:00.000Z',
    },
];

export default function AdminAcademyScreen() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'courses' | 'progress' | 'certificates'>('courses');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<CourseModule[]>(DEFAULT_COURSES);
    const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
    const [adminXp, setAdminXp] = useState<number>(350);

    // Modal State for New Course Creation
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [savingCourse, setSavingCourse] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<CourseModule['category']>('compliance');
    const [newDuration, setNewDuration] = useState('45 mins');
    const [newLevel, setNewLevel] = useState<CourseModule['level']>('Beginner');
    const [newDesc, setNewDesc] = useState('');
    const [newDocUrl, setNewDocUrl] = useState('');
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [newBadge, setNewBadge] = useState('Certified Specialist');
    const [newXp, setNewXp] = useState('150');
    const [newMandatory, setNewMandatory] = useState(true);

    // Filter
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Fetch persisted courses from app_settings
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
                setCourses(DEFAULT_COURSES);
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
                Alert.alert('Congratulations! 🎓', `Module completed! You earned +${xpReward} Staff XP.`);
            }
        } catch (err: any) {
            Alert.alert('Notice', err.message || 'Could not update progress.');
        }
    };

    // Save New Course
    const handleCreateCourse = async () => {
        if (!newTitle.trim()) {
            Alert.alert('Required', 'Please enter a course title.');
            return;
        }

        setSavingCourse(true);
        try {
            const newCourseItem: CourseModule = {
                id: `course-${Date.now()}`,
                title: newTitle.trim(),
                category: newCategory,
                duration: newDuration.trim() || '30 mins',
                level: newLevel,
                description: newDesc.trim() || 'Admin and staff training module.',
                docUrl: newDocUrl.trim() || undefined,
                videoUrl: newVideoUrl.trim() || undefined,
                rewardXp: Number(newXp) || 100,
                badgeName: newBadge.trim() || 'Certified Specialist',
                isMandatory: newMandatory,
                status: 'published',
                createdAt: new Date().toISOString(),
            };

            const updatedList = [newCourseItem, ...courses];
            setCourses(updatedList);

            await supabase.from('app_settings').upsert({
                key: 'admin_academy_courses',
                value: updatedList
            });

            setShowCreateModal(false);
            setNewTitle('');
            setNewDesc('');
            setNewDocUrl('');
            setNewVideoUrl('');
            Alert.alert('Success 🎉', 'New Academy training module published successfully!');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save course.');
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
                    title: 'Academy Hub & Staff Training',
                    headerStyle: { backgroundColor: C.navy },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontWeight: '800', fontSize: 17 },
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
                    <Text style={[styles.tabBtnText, activeTab === 'courses' && styles.tabBtnTextActive]}>Curriculum</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('progress')}
                    style={[styles.tabBtn, activeTab === 'progress' && styles.tabBtnActive]}
                >
                    <Ionicons name="stats-chart-outline" size={16} color={activeTab === 'progress' ? C.navy : C.textMuted} />
                    <Text style={[styles.tabBtnText, activeTab === 'progress' && styles.tabBtnTextActive]}>Staff Progress</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('certificates')}
                    style={[styles.tabBtn, activeTab === 'certificates' && styles.tabBtnActive]}
                >
                    <Ionicons name="ribbon-outline" size={16} color={activeTab === 'certificates' ? C.navy : C.textMuted} />
                    <Text style={[styles.tabBtnText, activeTab === 'certificates' && styles.tabBtnTextActive]}>Certifications</Text>
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
                                <Text style={styles.badgePillText}>EXECUTIVE ACADEMY</Text>
                            </View>
                            <Text style={styles.heroTitle}>Level 4 Certified Admin</Text>
                            <Text style={styles.heroSub}>Abu Mafhal Sub Staff & Agent Qualification Program</Text>
                        </View>
                        <View style={styles.iconCircleHero}>
                            <Ionicons name="school" size={28} color="#F59E0B" />
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(15, completionPercent))}%` }]} />
                    </View>

                    <View style={styles.heroFooter}>
                        <Text style={styles.heroFooterText}>
                            {completedCount} of {courses.length} Modules Completed ({completionPercent}%)
                        </Text>
                        <Text style={styles.xpText}>{adminXp} Staff XP ⭐</Text>
                    </View>
                </LinearGradient>

                {/* TAB 1: CURRICULUM */}
                {activeTab === 'courses' && (
                    <View>
                        {/* Action Bar: Create Course + Category Pills */}
                        <View style={styles.actionBar}>
                            <Text style={styles.sectionHeaderTitle}>TRAINING MODULES</Text>
                            <TouchableOpacity
                                onPress={() => setShowCreateModal(true)}
                                style={styles.addCourseBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                                <Text style={styles.addCourseBtnText}>Add Module</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Category Selector */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {[
                                { id: 'all', label: 'All Modules' },
                                { id: 'compliance', label: 'CBN & AML' },
                                { id: 'vtu_scaling', label: 'VTU Scaling' },
                                { id: 'support', label: 'Support & Ops' },
                                { id: 'security', label: 'API Security' },
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
                                <Ionicons name="document-text-outline" size={42} color={C.textDim} />
                                <Text style={styles.emptyTitle}>No modules in this category</Text>
                                <Text style={styles.emptySub}>Add a new training module or select another category.</Text>
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
                                                            <Text style={styles.mandPillText}>MANDATORY</Text>
                                                        </View>
                                                    )}
                                                    <View style={[styles.levelPill, { backgroundColor: course.level === 'Advanced' ? C.purpleLight : C.blueLight }]}>
                                                        <Text style={[styles.levelPillText, { color: course.level === 'Advanced' ? C.purple : C.blue }]}>
                                                            {course.level}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.durationText}>⏱️ {course.duration}</Text>
                                                </View>
                                                <Text style={styles.courseTitle}>{course.title}</Text>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => handleToggleComplete(course.id, course.rewardXp)}
                                                style={[
                                                    styles.checkBtn,
                                                    isCompleted ? styles.checkBtnDone : styles.checkBtnPending
                                                ]}
                                            >
                                                <Ionicons
                                                    name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                                                    size={22}
                                                    color={isCompleted ? C.emerald : C.textDim}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.courseDesc}>{course.description}</Text>

                                        {/* Reward & Resources Row */}
                                        <View style={styles.courseFooter}>
                                            <View style={styles.rewardBox}>
                                                <Ionicons name="star" size={13} color={C.gold} />
                                                <Text style={styles.rewardText}>+{course.rewardXp} XP</Text>
                                                <Text style={styles.badgeNameText}>• {course.badgeName}</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {course.docUrl && (
                                                    <TouchableOpacity
                                                        onPress={() => Linking.openURL(course.docUrl!)}
                                                        style={styles.linkActionBtn}
                                                    >
                                                        <Ionicons name="document-text" size={13} color={C.blue} />
                                                        <Text style={[styles.linkActionText, { color: C.blue }]}>Study Doc</Text>
                                                    </TouchableOpacity>
                                                )}

                                                {course.videoUrl && (
                                                    <TouchableOpacity
                                                        onPress={() => Linking.openURL(course.videoUrl!)}
                                                        style={[styles.linkActionBtn, { backgroundColor: C.redLight, borderColor: '#FECACA' }]}
                                                    >
                                                        <Ionicons name="logo-youtube" size={13} color={C.red} />
                                                        <Text style={[styles.linkActionText, { color: C.red }]}>Watch Video</Text>
                                                    </TouchableOpacity>
                                                )}
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
                        <Text style={styles.sectionHeaderTitle}>EXECUTIVE STAFF LEADERBOARD</Text>
                        <Text style={styles.sectionHeaderSub}>
                            Operational competency ranking for internal staff and tier-3 super agents.
                        </Text>

                        <View style={styles.statGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>{courses.length}</Text>
                                <Text style={styles.statLbl}>Total Courses</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={[styles.statVal, { color: C.emerald }]}>{completedCount}</Text>
                                <Text style={styles.statLbl}>Completed</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={[styles.statVal, { color: C.gold }]}>{adminXp}</Text>
                                <Text style={styles.statLbl}>Staff XP</Text>
                            </View>
                        </View>

                        <View style={styles.staffCard}>
                            <Text style={styles.staffCardTitle}>Required Admin Directives</Text>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>CBN Regulatory Audit: Pass minimum 80% on AML module.</Text>
                            </View>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>Incident Response: Resolve wallet debits within 15 minutes.</Text>
                            </View>
                            <View style={styles.directiveRow}>
                                <Ionicons name="checkmark-done-circle" size={18} color={C.emerald} />
                                <Text style={styles.directiveText}>API Security: Re-validate partner webhook secrets every 90 days.</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* TAB 3: CERTIFICATIONS */}
                {activeTab === 'certificates' && (
                    <View>
                        <Text style={styles.sectionHeaderTitle}>EARNED CREDENTIALS</Text>
                        <Text style={styles.sectionHeaderSub}>
                            Official Abu Mafhal Sub certifications verified for operational compliance.
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
                                        <View style={[styles.certRibbon, { backgroundColor: isEarned ? C.gold : C.border }]}>
                                            <Ionicons
                                                name={isEarned ? "ribbon" : "lock-closed"}
                                                size={32}
                                                color={isEarned ? "#FFFFFF" : C.textDim}
                                            />
                                        </View>
                                        <Text style={styles.certName}>{course.badgeName}</Text>
                                        <Text style={styles.certTrack}>{course.title}</Text>
                                        <View style={[styles.certStatusPill, isEarned ? { backgroundColor: C.emeraldLight } : { backgroundColor: '#F1F5F9' }]}>
                                            <Text style={[styles.certStatusText, { color: isEarned ? C.emerald : C.textDim }]}>
                                                {isEarned ? 'VERIFIED' : 'LOCKED'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* CREATE COURSE MODAL */}
            <Modal visible={showCreateModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Academy Module</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={24} color={C.navy} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 460 }}>
                            <Text style={styles.inputLabel}>Course Title *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g., Advanced Dispute Resolution"
                                placeholderTextColor={C.textDim}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={styles.inputLabel}>Category</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {(['compliance', 'vtu_scaling', 'support', 'security'] as const).map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setNewCategory(cat)}
                                        style={[styles.smallPill, newCategory === cat && styles.smallPillActive]}
                                    >
                                        <Text style={[styles.smallPillText, newCategory === cat && styles.smallPillTextActive]}>
                                            {cat.replace('_', ' ').toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Duration</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. 45 mins"
                                        placeholderTextColor={C.textDim}
                                        value={newDuration}
                                        onChangeText={setNewDuration}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Reward XP</Text>
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

                            <Text style={styles.inputLabel}>Badge / Certificate Title</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Certified Dispute Analyst"
                                placeholderTextColor={C.textDim}
                                value={newBadge}
                                onChangeText={setNewBadge}
                            />

                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                                placeholder="Core objectives of this module..."
                                placeholderTextColor={C.textDim}
                                multiline
                                value={newDesc}
                                onChangeText={setNewDesc}
                            />

                            <Text style={styles.inputLabel}>Documentation URL (Optional)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="https://..."
                                placeholderTextColor={C.textDim}
                                autoCapitalize="none"
                                value={newDocUrl}
                                onChangeText={setNewDocUrl}
                            />

                            <Text style={styles.inputLabel}>Video Lecture URL (Optional)</Text>
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
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleCreateCourse}
                                style={styles.saveBtn}
                                disabled={savingCourse}
                            >
                                {savingCourse ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Publish Module 🚀</Text>
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
        fontSize: 12.5,
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
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    heroSub: {
        fontSize: 11.5,
        color: '#94A3B8',
    },
    iconCircleHero: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
    courseTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: C.navy,
        marginTop: 2,
    },
    checkBtn: {
        padding: 4,
    },
    checkBtnDone: {},
    checkBtnPending: {},
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
        backgroundColor: C.blueLight,
        borderWidth: 1,
        borderColor: '#BFDBFE',
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
        width: 60,
        height: 60,
        borderRadius: 30,
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
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: C.navy,
    },
    inputLabel: {
        fontSize: 11,
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
        fontSize: 10,
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
    },
    saveBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
