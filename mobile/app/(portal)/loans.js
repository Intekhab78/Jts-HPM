import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useAuth } from '../_layout';
import axios from 'axios';

import { getApiUrl } from '../../config';

export default function LoansScreen() {
    const { token, user } = useAuth();
    const API_URL = getApiUrl();
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [emiMonths, setEmiMonths] = useState(1);

    useEffect(() => {
        fetchLoans();
    }, []);

    const fetchLoans = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/advances`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setLoans(res.data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestLoan = async () => {
        if (!amount || !reason) {
            Alert.alert('Validation Error', 'Please fill in both amount and reason.');
            return;
        }

        const employeeRefId = user?.employeeRef?._id || user?.employeeRef;

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/advances`, {
                employee: employeeRefId,
                amount: parseFloat(amount),
                emiMonths,
                reason
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                Alert.alert('Success', 'Loan request submitted successfully.');
                setModalVisible(false);
                setAmount('');
                setReason('');
                setEmiMonths(1);
                fetchLoans();
            }
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to submit request';
            Alert.alert('Request Failed', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const renderLoanItem = ({ item }) => (
        <View style={styles.loanCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.loanAmountText}>AED {item.amount}</Text>
                <View style={[styles.statusBadge, 
                    item.status === 'Disbursed' ? styles.approvedBadge : 
                    item.status === 'Completed' ? styles.completedBadge : 
                    item.status === 'Rejected' ? styles.rejectedBadge : styles.pendingBadge
                ]}>
                    <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
            </View>
            <Text style={styles.detailsText}>EMI Plan: AED {item.emiAmount} x {item.emiMonths} Month(s)</Text>
            <Text style={styles.detailsText}>Reason: {item.reason}</Text>
            
            {/* Repayment Progress Bar */}
            <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${(item.amountRepaid / item.amount) * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>AED {item.amountRepaid || 0} / {item.amount} Repaid</Text>
            </View>
            {item.isHeld && (
                <Text style={styles.heldText}>Deduction paused for this month</Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setModalVisible(true)}>
                <Text style={styles.applyBtnText}>+ Request Advance/Loan</Text>
            </TouchableOpacity>

            {loading ? (
                <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 20 }} />
            ) : (
                <FlatList 
                    data={loans}
                    keyExtractor={item => item._id}
                    renderItem={renderLoanItem}
                    contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No loan history found.</Text>}
                />
            )}

            {/* REQUEST LOAN MODAL */}
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
                        <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Request Salary Advance</Text>

                                <Text style={styles.label}>Amount (AED)</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. 5000" 
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="numeric"
                                    returnKeyType="done"
                                    value={amount}
                                    onChangeText={setAmount}
                                />

                                <Text style={styles.label}>Repayment Plan (EMI Months)</Text>
                                <View style={styles.typeRow}>
                                    {[1, 2, 3, 6].map(months => (
                                        <TouchableOpacity 
                                            key={months}
                                            style={[styles.typeBtn, emiMonths === months && styles.typeBtnActive]}
                                            onPress={() => setEmiMonths(months)}
                                        >
                                            <Text style={[styles.typeBtnText, emiMonths === months && styles.typeBtnTextActive]}>{months} M</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.label}>Reason</Text>
                                <TextInput 
                                    style={[styles.input, { height: 80 }]} 
                                    placeholder="e.g. Rent, Family emergency" 
                                    placeholderTextColor="#9ca3af"
                                    multiline
                                    numberOfLines={3}
                                    value={reason}
                                    onChangeText={setReason}
                                />

                                {amount ? (
                                    <View style={styles.emiEstimation}>
                                        <Text style={styles.estimationText}>Estimated monthly deduction: <Text style={styles.boldText}>AED {(parseFloat(amount) / emiMonths).toFixed(2)}</Text></Text>
                                    </View>
                                ) : null}

                                <View style={styles.modalActions}>
                                    <TouchableOpacity 
                                        style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} 
                                        onPress={() => setModalVisible(false)}
                                    >
                                        <Text style={styles.modalBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.modalBtn, { backgroundColor: '#f59e0b' }]} 
                                        onPress={handleRequestLoan}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#111827" />
                                        ) : (
                                            <Text style={[styles.modalBtnText, { color: '#111827' }]}>Submit</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 15,
    },
    applyBtn: {
        backgroundColor: '#f59e0b',
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    applyBtnText: {
        color: '#111827',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loanCard: {
        backgroundColor: '#1f2937',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    loanAmountText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    pendingBadge: {
        backgroundColor: '#4b5563',
    },
    approvedBadge: {
        backgroundColor: '#065f46', // Disbursed (success)
    },
    completedBadge: {
        backgroundColor: '#1d4ed8', // Paid off (primary)
    },
    rejectedBadge: {
        backgroundColor: '#991b1b',
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    detailsText: {
        color: '#d1d5db',
        fontSize: 13,
        marginBottom: 4,
    },
    progressRow: {
        marginTop: 12,
        gap: 6,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#374151',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10b981',
    },
    progressText: {
        color: '#9ca3af',
        fontSize: 11,
        textAlign: 'right',
    },
    heldText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
    },
    emptyText: {
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 30,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    label: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 6,
        marginTop: 10,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 5,
    },
    typeBtn: {
        flex: 1,
        height: 36,
        backgroundColor: '#111827',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    typeBtnActive: {
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
    },
    typeBtnText: {
        color: '#9ca3af',
        fontSize: 13,
    },
    typeBtnTextActive: {
        color: '#111827',
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#111827',
        height: 40,
        borderRadius: 6,
        paddingHorizontal: 12,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#374151',
    },
    emiEstimation: {
        marginTop: 15,
        padding: 10,
        backgroundColor: '#111827',
        borderRadius: 6,
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
    },
    estimationText: {
        color: '#9ca3af',
        fontSize: 13,
    },
    boldText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalBtn: {
        flex: 1,
        height: 40,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
