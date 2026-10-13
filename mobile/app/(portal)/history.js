import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { useAuth } from '../_layout';
import axios from 'axios';
import { getApiUrl, getImageUrl } from '../../config';

export default function HistoryScreen() {
    const { token, user } = useAuth();
    const API_URL = getApiUrl();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    useEffect(() => {
        fetchHistory();
    }, [selectedMonth]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const currentYear = new Date().getFullYear();
            
            // Get first and last day of selected month
            const startDate = new Date(currentYear, selectedMonth, 1).toISOString().split('T')[0];
            const endDate = new Date(currentYear, selectedMonth + 1, 0).toISOString().split('T')[0];

            const empRefId = user?.employeeRef?._id || user?.employeeRef;
            const res = await axios.get(`${API_URL}/attendance?startDate=${startDate}&endDate=${endDate}&employeeId=${empRefId || ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (e) {
            console.error('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    const renderHistoryItem = ({ item }) => {
        const checkInTime = item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const checkOutTime = item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        
        let statusColor = '#4b5563'; // Pending/Other
        if (item.status === 'Present') statusColor = '#059669'; // Emerald
        if (item.status === 'Absent') statusColor = '#dc2626'; // Red
        if (item.status === 'On Leave') statusColor = '#2563eb'; // Blue
        if (item.status === 'Late') statusColor = '#d97706'; // Amber

        return (
            <View style={styles.historyCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusBadgeText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.timeRow}>
                    <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>CHECK IN</Text>
                        <Text style={styles.timeValue}>{checkInTime}</Text>
                    </View>
                    <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>CHECK OUT</Text>
                        <Text style={styles.timeValue}>{checkOutTime}</Text>
                    </View>
                    <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>WORKED</Text>
                        <Text style={styles.timeValue}>{item.workHours ? `${item.workHours.toFixed(1)} hrs` : '--'}</Text>
                    </View>
                </View>

                {/* Biometric Match logs info */}
                <View style={styles.biometricRow}>
                    {item.faceMatchScore ? (
                        <View style={styles.verifiedRow}>
                            <Text style={styles.biometricLabel}>👤 Face Verified:</Text>
                            <Text style={styles.verifiedValue}>{item.faceMatchScore.toFixed(1)}% match</Text>
                        </View>
                    ) : item.source === 'Biometric' || item.source === 'Kiosk' ? (
                        <View style={styles.verifiedRow}>
                            <Text style={styles.biometricLabel}>🔑 PIN Authenticated</Text>
                        </View>
                    ) : (
                        <View style={styles.verifiedRow}>
                            <Text style={[styles.biometricLabel, { color: '#9ca3af' }]}>Log Source: {item.source || 'Web'}</Text>
                        </View>
                    )}
                </View>

                {/* Daily Punches Timeline */}
                {item.punches && item.punches.length > 0 && (
                    <View style={styles.punchesContainer}>
                        <Text style={styles.punchesTitle}>DAILY PUNCH TIMELINE ({item.punches.length})</Text>
                        <View style={styles.punchesList}>
                            {item.punches.map((p, idx) => {
                                const pTime = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const imgUri = p.photoPath ? getImageUrl(p.photoPath) : null;
                                const isFace = p.punchMethod === 'Face';
                                const pScore = isFace && p.faceMatchScore !== undefined
                                    ? Math.max(0, Math.round((1 - p.faceMatchScore) * 100))
                                    : 100;
                                
                                return (
                                    <View key={idx} style={styles.punchRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.punchTimeText}>{pTime}</Text>
                                            <Text style={styles.punchMethodText}>[{p.punchMethod}]</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            {imgUri && (
                                                <Image 
                                                    source={{ uri: imgUri }} 
                                                    style={styles.punchAuditImage} 
                                                />
                                            )}
                                            <View style={[styles.punchScoreBadge, { backgroundColor: pScore >= 50 ? '#059669' : '#dc2626' }]}>
                                                <Text style={styles.punchScoreText}>{pScore}%</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Horizontal Months Selector */}
            <View style={styles.filterContainer}>
                <FlatList
                    horizontal
                    data={months}
                    keyExtractor={(item, index) => index.toString()}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}
                    renderItem={({ item, index }) => (
                        <TouchableOpacity 
                            style={[styles.monthFilterBtn, selectedMonth === index && styles.monthFilterBtnActive]}
                            onPress={() => setSelectedMonth(index)}
                        >
                            <Text style={[styles.monthFilterText, selectedMonth === index && styles.monthFilterTextActive]}>{item.slice(0, 3)}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 40 }} />
            ) : (
                <FlatList 
                    data={history}
                    keyExtractor={item => item._id}
                    renderItem={renderHistoryItem}
                    contentContainerStyle={{ padding: 15, gap: 12, paddingBottom: 30 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No attendance logs recorded for this month.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    filterContainer: {
        backgroundColor: '#1f2937',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    monthFilterBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#374151',
    },
    monthFilterBtnActive: {
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
    },
    monthFilterText: {
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: '500',
    },
    monthFilterTextActive: {
        color: '#111827',
        fontWeight: 'bold',
    },
    historyCard: {
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
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
        paddingBottom: 10,
        marginBottom: 10,
    },
    dateText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeCol: {
        flex: 1,
        alignItems: 'center',
    },
    timeLabel: {
        color: '#9ca3af',
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    timeValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    biometricRow: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#374151',
        paddingTop: 8,
    },
    verifiedRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 6,
    },
    biometricLabel: {
        color: '#10b981',
        fontSize: 12,
    },
    verifiedValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
    },
    punchesContainer: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#374151',
        paddingTop: 10,
    },
    punchesTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    punchesList: {
        gap: 6,
    },
    punchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#374151',
    },
    punchTimeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3b82f6',
    },
    punchMethodText: {
        fontSize: 10,
        color: '#9ca3af',
    },
    punchAuditImage: {
        width: 24,
        height: 24,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#4b5563',
    },
    punchScoreBadge: {
        paddingVertical: 1,
        paddingHorizontal: 4,
        borderRadius: 3,
    },
    punchScoreText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
});
