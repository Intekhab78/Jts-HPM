import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    FlatList, 
    TextInput, 
    TouchableOpacity, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    Platform, 
    KeyboardAvoidingView, 
    ScrollView, 
    TouchableWithoutFeedback, 
    Keyboard,
    RefreshControl
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../_layout';
import axios from 'axios';
import { getApiUrl } from '../../config';

export default function LeavesScreen() {
    const { token, user } = useAuth();
    const API_URL = getApiUrl();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [leaveType, setLeaveType] = useState('Annual');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [reason, setReason] = useState('');

    // Picker state
    const [showPicker, setShowPicker] = useState(false);
    const [pickerTarget, setPickerTarget] = useState('start'); // 'start' | 'end'

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/leaves`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setLeaves(res.data.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchLeaves();
    };

    const formatDateDisplay = (dateObj) => {
        if (!dateObj) return '';
        return dateObj.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatApiDate = (dateObj) => {
        if (!dateObj) return '';
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const calculateDays = () => {
        if (!startDate || !endDate) return 1;
        const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const diffMs = e.getTime() - s.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 1;
    };

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }
        if (event.type === 'dismissed') {
            return;
        }
        if (selectedDate) {
            if (pickerTarget === 'start') {
                setStartDate(selectedDate);
                if (selectedDate > endDate) {
                    setEndDate(selectedDate);
                }
            } else {
                if (selectedDate < startDate) {
                    setStartDate(selectedDate);
                }
                setEndDate(selectedDate);
            }
        }
    };

    const openDatePicker = (target) => {
        setPickerTarget(target);
        setShowPicker(true);
    };

    const handleRequestLeave = async () => {
        if (!reason.trim()) {
            Alert.alert('Validation Error', 'Please provide a reason for the leave request.');
            return;
        }

        const employeeRefId = user?.employeeRef?._id || user?.employeeRef;
        const totalDays = calculateDays();

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/leaves`, {
                employee: employeeRefId,
                leaveType,
                startDate: formatApiDate(startDate),
                endDate: formatApiDate(endDate),
                fromDate: formatApiDate(startDate),
                toDate: formatApiDate(endDate),
                totalDays,
                reason: reason.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                Alert.alert('Success', `Leave request (${totalDays} day${totalDays > 1 ? 's' : ''}) submitted successfully.`);
                setModalVisible(false);
                setReason('');
                setStartDate(new Date());
                setEndDate(new Date());
                fetchLeaves();
            }
        } catch (error) {
            console.error('Leave submission error:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to submit leave request';
            Alert.alert('Leave Application Notice', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const renderLeaveItem = ({ item }) => {
        const from = item.fromDate || item.startDate;
        const to = item.toDate || item.endDate;
        const fromStr = from ? new Date(from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const toStr = to ? new Date(to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        return (
            <View style={styles.leaveCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.leaveTypeText}>{item.leaveType} Leave</Text>
                        <View style={styles.daysBadge}>
                            <Text style={styles.daysBadgeText}>{item.totalDays || 1} {item.totalDays === 1 ? 'Day' : 'Days'}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, 
                        item.status === 'Approved' ? styles.approvedBadge : 
                        item.status === 'Rejected' ? styles.rejectedBadge : styles.pendingBadge
                    ]}>
                        <Text style={styles.statusBadgeText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.dateBlockCard}>
                    <Text style={styles.calendarIcon}>📅</Text>
                    <Text style={styles.datesText}>{fromStr} → {toStr}</Text>
                </View>

                <Text style={styles.reasonText} numberOfLines={2}>
                    <Text style={{ color: '#9ca3af', fontWeight: '600' }}>Reason: </Text>
                    {item.reason}
                </Text>

                {item.createdAt && (
                    <Text style={styles.appliedOnText}>
                        Applied on {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* TOP ACTION BAR */}
            <TouchableOpacity 
                style={styles.applyBtn} 
                onPress={() => setModalVisible(true)}
                activeOpacity={0.85}
            >
                <Text style={styles.applyBtnIcon}>➕</Text>
                <Text style={styles.applyBtnText}>Apply For Leave</Text>
            </TouchableOpacity>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={styles.loadingText}>Loading leave records...</Text>
                </View>
            ) : (
                <FlatList 
                    data={leaves}
                    keyExtractor={item => item._id}
                    renderItem={renderLeaveItem}
                    contentContainerStyle={{ gap: 12, paddingBottom: 30 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🏖️</Text>
                            <Text style={styles.emptyTitle}>No Leave Records</Text>
                            <Text style={styles.emptyText}>You haven't submitted any leave applications yet.</Text>
                        </View>
                    }
                />
            )}

            {/* REQUEST LEAVE MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView 
                            contentContainerStyle={styles.modalScrollContent} 
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.modalContent}>
                                {/* HEADER */}
                                <View style={styles.modalHeader}>
                                    <View>
                                        <Text style={styles.modalTitle}>Apply For Leave</Text>
                                        <Text style={styles.modalSubtitle}>Submit request for manager & HR review</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setModalVisible(false)}
                                        style={styles.closeHeaderBtn}
                                    >
                                        <Text style={styles.closeHeaderBtnText}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* LEAVE TYPE SELECTOR */}
                                <Text style={styles.label}>LEAVE TYPE</Text>
                                <View style={styles.typeGrid}>
                                    {[
                                        { key: 'Annual', label: 'Annual', icon: '🏖️' },
                                        { key: 'Sick', label: 'Sick', icon: '🩺' },
                                        { key: 'Unpaid', label: 'Unpaid', icon: '⏸️' },
                                        { key: 'Emergency', label: 'Emergency', icon: '🚨' }
                                    ].map(t => (
                                        <TouchableOpacity 
                                            key={t.key}
                                            style={[styles.typeBtn, leaveType === t.key && styles.typeBtnActive]}
                                            onPress={() => setLeaveType(t.key)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.typeIcon}>{t.icon}</Text>
                                            <Text style={[styles.typeBtnText, leaveType === t.key && styles.typeBtnTextActive]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* INTERACTIVE DATE PICKER BLOCKS */}
                                <Text style={styles.label}>DATE SELECTION</Text>
                                <View style={styles.datePickerRow}>
                                    {/* Start Date Block */}
                                    <TouchableOpacity 
                                        style={styles.dateBlock}
                                        onPress={() => openDatePicker('start')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.dateBlockLabel}>FROM DATE</Text>
                                        <Text style={styles.dateBlockVal}>{formatDateDisplay(startDate)}</Text>
                                        <Text style={styles.dateBlockHint}>Tap to change</Text>
                                    </TouchableOpacity>

                                    {/* Divider Arrow */}
                                    <View style={styles.dateArrowContainer}>
                                        <Text style={styles.dateArrow}>→</Text>
                                    </View>

                                    {/* End Date Block */}
                                    <TouchableOpacity 
                                        style={styles.dateBlock}
                                        onPress={() => openDatePicker('end')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.dateBlockLabel}>TO DATE</Text>
                                        <Text style={styles.dateBlockVal}>{formatDateDisplay(endDate)}</Text>
                                        <Text style={styles.dateBlockHint}>Tap to change</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* DURATION SUMMARY BANNER */}
                                <View style={styles.durationBanner}>
                                    <Text style={styles.durationBannerText}>
                                        Requested Duration: <Text style={styles.durationBannerBold}>{calculateDays()} Day{calculateDays() > 1 ? 's' : ''}</Text>
                                    </Text>
                                </View>

                                {/* REASON INPUT */}
                                <Text style={styles.label}>REASON FOR LEAVE</Text>
                                <TextInput 
                                    style={styles.inputArea} 
                                    placeholder="Explain the reason for your leave request..." 
                                    placeholderTextColor="#6b7280"
                                    multiline
                                    numberOfLines={3}
                                    value={reason}
                                    onChangeText={setReason}
                                    textAlignVertical="top"
                                />

                                {/* MODAL ACTIONS */}
                                <View style={styles.modalActions}>
                                    <TouchableOpacity 
                                        style={styles.cancelBtn} 
                                        onPress={() => setModalVisible(false)}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.submitBtn} 
                                        onPress={handleRequestLeave}
                                        disabled={submitting}
                                        activeOpacity={0.85}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#111827" />
                                        ) : (
                                            <Text style={styles.submitBtnText}>Submit Application</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* IOS DATE PICKER MODAL */}
            {Platform.OS === 'ios' && showPicker && (
                <Modal
                    transparent={true}
                    animationType="fade"
                    visible={showPicker}
                    onRequestClose={() => setShowPicker(false)}
                >
                    <View style={styles.iosPickerOverlay}>
                        <View style={styles.iosPickerContainer}>
                            <View style={styles.iosPickerHeader}>
                                <Text style={styles.iosPickerTitle}>
                                    {pickerTarget === 'start' ? 'Select Start Date' : 'Select End Date'}
                                </Text>
                                <TouchableOpacity 
                                    style={styles.iosPickerDoneBtn}
                                    onPress={() => setShowPicker(false)}
                                >
                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={pickerTarget === 'start' ? startDate : endDate}
                                mode="date"
                                display="spinner"
                                textColor="#ffffff"
                                themeVariant="dark"
                                onChange={handleDateChange}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {/* ANDROID DATE PICKER */}
            {Platform.OS === 'android' && showPicker && (
                <DateTimePicker
                    value={pickerTarget === 'start' ? startDate : endDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    loadingText: {
        color: '#9ca3af',
        fontSize: 14,
        marginTop: 12,
    },
    applyBtn: {
        backgroundColor: '#f59e0b',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    applyBtnIcon: {
        fontSize: 16,
    },
    applyBtnText: {
        color: '#111827',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.3,
    },
    leaveCard: {
        backgroundColor: '#1f2937',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    leaveTypeText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    daysBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    daysBadgeText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    pendingBadge: {
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        borderWidth: 1,
        borderColor: '#6b7280',
    },
    approvedBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: '#10b981',
    },
    rejectedBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    statusBadgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    dateBlockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#111827',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    calendarIcon: {
        fontSize: 14,
    },
    datesText: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '500',
    },
    reasonText: {
        color: '#e5e7eb',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    appliedOnText: {
        color: '#6b7280',
        fontSize: 11,
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },

    // MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 20,
    },
    modalContent: {
        width: '96%',
        maxWidth: 480,
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 22,
        borderWidth: 1,
        borderColor: '#374151',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
        paddingBottom: 14,
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalSubtitle: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 2,
    },
    closeHeaderBtn: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#111827',
    },
    closeHeaderBtnText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: 'bold',
    },
    label: {
        color: '#9ca3af',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginTop: 12,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    typeBtn: {
        flex: 1,
        minWidth: '22%',
        height: 48,
        backgroundColor: '#111827',
        borderRadius: 10,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    typeBtnActive: {
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
    },
    typeIcon: {
        fontSize: 14,
        marginBottom: 2,
    },
    typeBtnText: {
        color: '#9ca3af',
        fontSize: 11,
        fontWeight: '600',
    },
    typeBtnTextActive: {
        color: '#111827',
        fontWeight: 'bold',
    },

    // DATE PICKER BLOCKS
    datePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 10,
    },
    dateBlock: {
        flex: 1,
        backgroundColor: '#111827',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1.5,
        borderColor: '#374151',
        alignItems: 'center',
    },
    dateBlockLabel: {
        color: '#f59e0b',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    dateBlockVal: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    dateBlockHint: {
        color: '#6b7280',
        fontSize: 10,
    },
    dateArrowContainer: {
        paddingHorizontal: 4,
    },
    dateArrow: {
        color: '#9ca3af',
        fontSize: 18,
        fontWeight: 'bold',
    },
    durationBanner: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b',
        marginBottom: 8,
    },
    durationBannerText: {
        color: '#d1d5db',
        fontSize: 12,
    },
    durationBannerBold: {
        color: '#f59e0b',
        fontWeight: 'bold',
    },
    inputArea: {
        backgroundColor: '#111827',
        height: 80,
        borderRadius: 10,
        padding: 12,
        color: '#ffffff',
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 22,
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '600',
    },
    submitBtn: {
        flex: 2,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: 'bold',
    },

    // IOS PICKER MODAL
    iosPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    iosPickerContainer: {
        backgroundColor: '#1f2937',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 30,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    iosPickerTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    iosPickerDoneBtn: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        backgroundColor: '#f59e0b',
        borderRadius: 6,
    },
    iosPickerDoneText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: 'bold',
    },
});

