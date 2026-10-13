import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Modal, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '../_layout';
import axios from 'axios';
import { getApiUrl, getImageUrl } from '../../config';

export default function DashboardScreen() {
    const { user, token, logout } = useAuth();
    const API_URL = getApiUrl();
    const cameraRef = useRef(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    
    // GPS & Punch states
    const [gpsCoords, setGpsCoords] = useState(null);
    const [gpsError, setGpsError] = useState(null);
    const [isMocked, setIsMocked] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [punching, setPunching] = useState(false);
    const [todayAttendance, setTodayAttendance] = useState(null);
    
    // Camera modal states
    const [cameraActive, setCameraActive] = useState(false);
    const [targetPunchType, setTargetPunchType] = useState(null);

    // QR modal states
    const [qrModalActive, setQrModalActive] = useState(false);
    const [qrPayload, setQrPayload] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(60);

    useEffect(() => {
        requestLocationPermission();
        fetchTodayAttendance();
    }, []);

    useEffect(() => {
        let interval;
        if (qrModalActive) {
            generateNewQrKey();
            interval = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        generateNewQrKey();
                        return 60;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [qrModalActive]);

    const requestLocationPermission = async () => {
        setFetchingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setGpsError('GPS permission denied. Geofenced punches might be blocked.');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setGpsCoords(loc.coords);
            setIsMocked(loc.mocked || false);
            setGpsError(null);
        } catch (e) {
            console.error(e);
            setGpsError('Failed to fetch GPS coordinates.');
        } finally {
            setFetchingLocation(false);
        }
    };

    const generateNewQrKey = () => {
        const payload = {
            employeeId: user?.employeeId || 'N/A',
            timestamp: new Date().toISOString()
        };
        setQrPayload(JSON.stringify(payload));
        setSecondsLeft(60);
    };

    const fetchTodayAttendance = async () => {
        try {
            // Local timezone date calculation to prevent UTC day shifting
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const empRefId = user?.employeeRef?._id || user?.employeeRef;
            const res = await axios.get(`${API_URL}/attendance?startDate=${today}&endDate=${today}&employeeId=${empRefId || ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.data.length > 0) {
                setTodayAttendance(res.data.data[0]);
            } else {
                setTodayAttendance(null);
            }
        } catch (e) {
            console.error('Failed to load today attendance', e);
        }
    };

    const triggerPunchFlow = async (type) => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res?.granted) {
                Alert.alert('Permission Required', 'Camera access permission is required to capture verification selfie.');
                return;
            }
        }
        setTargetPunchType(type);
        setCameraActive(true);
    };

    const handleCameraPunch = async () => {
        if (!cameraRef.current) return;

        setPunching(true);
        try {
            // 1. Capture base64 selfie frame
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.4,
                base64: true,
            });

            // 2. Fetch fresh GPS coordinates safely
            let loc = null;
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                }
            } catch (gpsErr) {
                console.warn('Location capture warning:', gpsErr.message);
            }

            const mockDetected = loc?.mocked || false;

            // 3. Send punch request to backend
            const res = await axios.post(`${API_URL}/attendance/punch`, {
                type: targetPunchType,
                lat: loc?.coords?.latitude || null,
                lng: loc?.coords?.longitude || null,
                faceImageBase64: photo.base64,
                mocked: mockDetected
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                Alert.alert('Success', `Successfully punched ${targetPunchType === 'in' ? 'IN' : 'OUT'}!\nAttendance recorded.`);
                setCameraActive(false);
                fetchTodayAttendance();
            }
        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 401) {
                Alert.alert(
                    'Session Expired',
                    'Your login session has expired. Please log in again to continue.',
                    [{ text: 'Log In Again', onPress: () => logout() }]
                );
            } else {
                const msg = error.response?.data?.message || 'Failed to submit punch';
                Alert.alert('Punch Failed', msg);
            }
        } finally {
            setPunching(false);
        }
    };

    const profilePicUri = user?.profilePhoto 
        ? getImageUrl(user.profilePhoto)
        : 'https://avatar.iran.liara.run/public/boy';

    return (
        <View style={styles.container}>
            <View style={styles.infoCard}>
                <Image source={{ uri: profilePicUri }} style={styles.profileImg} />
                <View style={styles.detailsCol}>
                    <Text style={styles.employeeName}>{user?.name || 'Employee'}</Text>
                    <Text style={styles.infoText}>ID: <Text style={styles.bold}>{user?.employeeId || 'N/A'}</Text></Text>
                    <Text style={styles.infoText}>Designation: <Text style={styles.bold}>{user?.designation || 'Staff'}</Text></Text>
                    <Text style={styles.infoText}>Department: <Text style={styles.bold}>{user?.department || 'Operations'}</Text></Text>
                    <Text style={styles.infoText}>Kiosk PIN: <Text style={[styles.bold, { color: '#f59e0b' }]}>{user?.employeeRef?.kioskPin || '1234'}</Text></Text>
                </View>
            </View>

            <View style={styles.attendanceCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.cardTitle}>Today's Punch Board</Text>
                    {todayAttendance?.status && (
                        <View style={{ backgroundColor: todayAttendance.status === 'Present' ? '#10b981' : todayAttendance.status === 'Late' ? '#f59e0b' : '#374151', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{todayAttendance.status}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>First Punch (Check In):</Text>
                    <Text style={styles.statusValue}>{todayAttendance?.checkIn ? new Date(todayAttendance.checkIn).toLocaleTimeString() : 'Not Checked In'}</Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Latest Punch (Check Out):</Text>
                    <Text style={styles.statusValue}>{todayAttendance?.checkOut ? new Date(todayAttendance.checkOut).toLocaleTimeString() : (todayAttendance?.checkIn ? 'Active (Checked In)' : 'Not Checked Out')}</Text>
                </View>
                {todayAttendance?.punches && todayAttendance.punches.length > 0 && (
                    <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.statusLabel}>Total Punches Today:</Text>
                        <Text style={[styles.statusValue, { color: '#f59e0b', fontWeight: 'bold' }]}>{todayAttendance.punches.length} recorded</Text>
                    </View>
                )}
            </View>

            <View style={styles.gpsCard}>
                <Text style={styles.gpsTitle}>GPS Geofence Status</Text>
                {fetchingLocation ? (
                    <ActivityIndicator color="#f59e0b" style={{ marginVertical: 10 }} />
                ) : gpsError ? (
                    <Text style={styles.gpsErrorText}>{gpsError}</Text>
                ) : gpsCoords ? (
                    <Text style={styles.gpsText}>Lat: {gpsCoords.latitude.toFixed(6)}, Lng: {gpsCoords.longitude.toFixed(6)}</Text>
                ) : (
                    <Text style={styles.gpsText}>Acquiring location...</Text>
                )}
                {isMocked && (
                    <Text style={styles.warningText}>⚠️ Spoofed/Mock GPS application active!</Text>
                )}
                <TouchableOpacity style={styles.refreshBtn} onPress={requestLocationPermission}>
                    <Text style={styles.refreshBtnText}>Update GPS Location</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.actionsCard}>
                <View style={styles.btnRow}>
                    <TouchableOpacity 
                        style={[styles.punchBtn, { backgroundColor: '#10b981', opacity: punching ? 0.7 : 1 }]} 
                        onPress={() => triggerPunchFlow('in')}
                        disabled={punching}
                    >
                        <Text style={styles.punchBtnText}>Punch IN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.punchBtn, { backgroundColor: '#ef4444', opacity: punching ? 0.7 : 1 }]} 
                        onPress={() => triggerPunchFlow('out')}
                        disabled={punching}
                    >
                        <Text style={styles.punchBtnText}>Punch OUT</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.qrTriggerBtn} onPress={() => setQrModalActive(true)}>
                    <Text style={styles.qrTriggerBtnText}>🔑 View Check-In QR Key</Text>
                </TouchableOpacity>
            </View>

            {/* CAMERA FACE CAPTURE MODAL */}
            <Modal animationType="slide" transparent={false} visible={cameraActive}>
                <View style={styles.cameraOverlay}>
                    {cameraPermission?.granted ? (
                        <View style={styles.cameraView}>
                            <CameraView style={styles.camera} facing="front" ref={cameraRef} />
                            <View style={styles.cameraGuideContainer} pointerEvents="none">
                                <View style={styles.faceTargetCircle} />
                                <Text style={styles.guideText}>Frame your face inside the circle</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noCameraView}>
                            <ActivityIndicator size="large" color="#f59e0b" style={{ marginBottom: 16 }} />
                            <Text style={styles.placeholderText}>
                                {!cameraPermission ? 'Initializing Camera System...' : 'Camera Access Permission Required'}
                            </Text>
                            {cameraPermission && !cameraPermission.granted && (
                                <TouchableOpacity style={styles.grantBtn} onPress={requestCameraPermission}>
                                    <Text style={styles.grantBtnText}>Grant Camera Access</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={styles.cameraControls}>
                        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#ef4444' }]} onPress={() => setCameraActive(false)}>
                            <Text style={styles.controlBtnText}>Cancel</Text>
                        </TouchableOpacity>

                        {punching ? (
                            <ActivityIndicator size="large" color="#f59e0b" style={{ flex: 1 }} />
                        ) : (
                            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#f59e0b', flex: 1.5 }]} onPress={handleCameraPunch}>
                                <Text style={[styles.controlBtnText, { color: '#111827' }]}>Verify & Punch</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* CHECK-IN QR KEY MODAL */}
            <Modal animationType="fade" transparent={true} visible={qrModalActive}>
                <View style={styles.qrModalOverlay}>
                    <View style={styles.qrModalContent}>
                        <Text style={styles.qrModalTitle}>My Check-In QR Key</Text>
                        
                        <View style={styles.qrCodeBox}>
                            <View style={styles.qrCornerTopLeft} />
                            <View style={styles.qrCornerTopRight} />
                            <View style={styles.qrCornerBottomLeft} />
                            <View style={styles.qrCornerBottomRight} />
                            <Text style={styles.qrInnerSymbol}>[ QR ]</Text>
                        </View>

                        <View style={styles.payloadBox}>
                            <Text style={styles.payloadTitle}>Token Payload (Decoded by Kiosk):</Text>
                            <Text style={styles.payloadText}>{qrPayload}</Text>
                        </View>

                        <Text style={styles.timerText}>Regenerating in <Text style={styles.boldTimer}>{secondsLeft}s</Text></Text>

                        <View style={styles.modalActionsRow}>
                            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#4b5563' }]} onPress={() => setQrModalActive(false)}>
                                <Text style={styles.modalCloseBtnText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#f59e0b' }]} onPress={generateNewQrKey}>
                                <Text style={[styles.modalCloseBtnText, { color: '#111827' }]}>Refresh</Text>
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
        backgroundColor: '#111827',
        padding: 15,
        gap: 15,
    },
    infoCard: {
        backgroundColor: '#1f2937',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    profileImg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#374151',
        borderWidth: 2,
        borderColor: '#f59e0b',
    },
    detailsCol: {
        flex: 1,
    },
    employeeName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    infoText: {
        color: '#d1d5db',
        fontSize: 14,
        marginBottom: 4,
    },
    bold: {
        fontWeight: 'bold',
        color: '#fff',
    },
    attendanceCard: {
        backgroundColor: '#1f2937',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    statusLabel: {
        color: '#9ca3af',
        fontSize: 14,
    },
    statusValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    gpsCard: {
        backgroundColor: '#1f2937',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
    },
    gpsTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    gpsText: {
        color: '#10b981',
        fontSize: 13,
        marginVertical: 4,
    },
    warningText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: 'bold',
        marginVertical: 4,
    },
    gpsErrorText: {
        color: '#ef4444',
        fontSize: 12,
        marginVertical: 4,
        textAlign: 'center',
    },
    refreshBtn: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#374151',
        borderRadius: 4,
    },
    refreshBtnText: {
        color: '#fff',
        fontSize: 12,
    },
    actionsCard: {
        backgroundColor: '#1f2937',
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 15,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 20,
        width: '100%',
        justifyContent: 'center',
    },
    punchBtn: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    punchBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    qrTriggerBtn: {
        width: '100%',
        height: 44,
        backgroundColor: '#374151',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4b5563',
    },
    qrTriggerBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    cameraOverlay: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraView: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    noCameraView: {
        flex: 1,
        backgroundColor: '#1f2937',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderText: {
        color: '#9ca3af',
        fontSize: 16,
        textAlign: 'center',
    },
    grantBtn: {
        marginTop: 15,
        backgroundColor: '#f59e0b',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    grantBtnText: {
        color: '#111827',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cameraGuideContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    faceTargetCircle: {
        width: 250,
        height: 250,
        borderRadius: 125,
        borderWidth: 4,
        borderColor: '#f59e0b',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    guideText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    cameraControls: {
        flexDirection: 'row',
        height: 80,
        backgroundColor: '#111827',
        padding: 15,
        alignItems: 'center',
        gap: 15,
    },
    controlBtn: {
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    controlBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // QR MODAL STYLES
    qrModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    qrModalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 25,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    qrModalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    qrCodeBox: {
        width: 170,
        height: 170,
        backgroundColor: '#fff',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginBottom: 20,
    },
    qrCornerTopLeft: {
        position: 'absolute',
        top: 15,
        left: 15,
        width: 25,
        height: 25,
        borderWidth: 4,
        borderColor: '#111827',
    },
    qrCornerTopRight: {
        position: 'absolute',
        top: 15,
        right: 15,
        width: 25,
        height: 25,
        borderWidth: 4,
        borderColor: '#111827',
    },
    qrCornerBottomLeft: {
        position: 'absolute',
        bottom: 15,
        left: 15,
        width: 25,
        height: 25,
        borderWidth: 4,
        borderColor: '#111827',
    },
    qrCornerBottomRight: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        width: 25,
        height: 25,
        borderWidth: 4,
        borderColor: '#111827',
    },
    qrInnerSymbol: {
        color: '#111827',
        fontSize: 18,
        fontWeight: 'bold',
    },
    payloadBox: {
        width: '100%',
        backgroundColor: '#111827',
        padding: 10,
        borderRadius: 6,
        marginBottom: 15,
    },
    payloadTitle: {
        color: '#9ca3af',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    payloadText: {
        color: '#10b981',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    timerText: {
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 20,
    },
    boldTimer: {
        color: '#f59e0b',
        fontWeight: 'bold',
    },
    modalActionsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCloseBtn: {
        flex: 1,
        height: 40,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
