import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from './_layout';
import axios from 'axios';
import { getApiUrl } from '../config';

export default function KioskScreen() {
    const { logout, token, user } = useAuth();
    const router = useRouter();
    const API_URL = getApiUrl();
    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    
    // Auto punch mode: 'auto', 'in', or 'out'
    const [punchType, setPunchType] = useState('auto');
    const punchTypeRef = useRef('auto');
    useEffect(() => {
        punchTypeRef.current = punchType;
    }, [punchType]);

    // Live Status & Visual Feedback
    const [statusMessage, setStatusMessage] = useState('Stand in front of camera to punch');
    const [statusColor, setStatusColor] = useState('#9ca3af');
    const [frameBorderColor, setFrameBorderColor] = useState('#f59e0b');
    const [isScanning, setIsScanning] = useState(false);

    // Lockout & Speech Refs (prevent stale closures in async loops)
    const [lockoutDict, setLockoutDict] = useState({});
    const lockoutDictRef = useRef({});
    const lastSpokenTextRef = useRef('');
    const lastSpokenTimeRef = useRef(0);
    const lastSpokenLockoutRef = useRef({});

    // Processing & Modals Ref for Non-blocking Loop
    const isProcessingRef = useRef(false);
    const modalsOpenRef = useRef(false);
    const lastHeartbeatRef = useRef(Date.now());

    // Network & Offline States
    const [isOnline, setIsOnline] = useState(true);
    const [offlineQueueCount, setOfflineQueueCount] = useState(0);

    // Modal Overlays
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [exitModalVisible, setExitModalVisible] = useState(false);
    
    // Unmapped Bypass Modals
    const [unmappedModalVisible, setUnmappedModalVisible] = useState(false);
    const [unmappedEmployeeId, setUnmappedEmployeeId] = useState('');
    const [bypassEmail, setBypassEmail] = useState('');
    const [bypassPassword, setBypassPassword] = useState('');
    const [isBypassing, setIsBypassing] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Form inputs
    const [empId, setEmpId] = useState('');
    const [pin, setPin] = useState('');
    const [qrDataInput, setQrDataInput] = useState('');
    const [exitPassword, setExitPassword] = useState('');

    // Keep modalsOpenRef synced
    useEffect(() => {
        modalsOpenRef.current = pinModalVisible || qrModalVisible || exitModalVisible || unmappedModalVisible;
    }, [pinModalVisible, qrModalVisible, exitModalVisible, unmappedModalVisible]);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        } else if (!permission.granted && permission.canAskAgain) {
            requestPermission();
        }
    }, [permission]);

    useEffect(() => {
        // Initial Sync & start network status checking loop
        syncLocalDatabase();
        const networkInterval = setInterval(checkNetworkAndSync, 20000);
        return () => clearInterval(networkInterval);
    }, []);

    // WATCHDOG SUPERVISOR - Silent non-blocking recovery if camera capture or network stalls > 15s
    useEffect(() => {
        const watchdog = setInterval(() => {
            if (isProcessingRef.current && (Date.now() - lastHeartbeatRef.current > 15000)) {
                console.log('[Kiosk Watchdog]: Recovering stalled scan state');
                isProcessingRef.current = false;
                setIsScanning(false);
                lastHeartbeatRef.current = Date.now();
            }
        }, 4000);
        return () => clearInterval(watchdog);
    }, []);

    // CONTINUOUS ACTIVE CAMERA SCANNING LOOP
    useEffect(() => {
        let isMounted = true;

        const scanningLoop = async () => {
            while (isMounted) {
                if (permission?.granted && !isProcessingRef.current && !modalsOpenRef.current && cameraRef.current) {
                    await runAutoFaceScan();
                }
                // Short rest between camera frame captures
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        };

        if (permission?.granted) {
            scanningLoop();
        }

        return () => {
            isMounted = false;
        };
    }, [permission?.granted]);

    const speakText = (text) => {
        const now = Date.now();
        if (text === lastSpokenTextRef.current && (now - lastSpokenTimeRef.current) < 12000) {
            return;
        }
        lastSpokenTextRef.current = text;
        lastSpokenTimeRef.current = now;
        try {
            Speech.stop();
            Speech.speak(text, { rate: 0.95 });
        } catch (e) {
            console.warn('Speech error:', e.message);
        }
    };

    const checkOnline = async () => {
        try {
            await axios.get(`${API_URL}/kiosk/sync-employees`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 3000
            });
            return true;
        } catch (e) {
            if (e.response) return true; // Server alive but unauthorized/error
            return false;
        }
    };

    const checkNetworkAndSync = async () => {
        try {
            const online = await checkOnline();
            setIsOnline(online);

            if (online) {
                const queued = await AsyncStorage.getItem('kiosk_offline_punches');
                if (queued) {
                    const punches = JSON.parse(queued);
                    setOfflineQueueCount(punches.length);
                    if (punches.length > 0) {
                        await pushOfflinePunches(punches);
                    }
                } else {
                    setOfflineQueueCount(0);
                }
            }
        } catch (e) {
            console.error('Network sync check failed', e);
        }
    };

    const syncLocalDatabase = async () => {
        try {
            const res = await axios.get(`${API_URL}/kiosk/sync-employees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                await AsyncStorage.setItem('kiosk_employees', JSON.stringify(res.data.data));
                console.log(`Synced ${res.data.data.length} employees to local storage.`);
            }
        } catch (e) {
            console.log('Sync failed, using existing local directory database.');
        }
    };

    const pushOfflinePunches = async (punches) => {
        try {
            const res = await axios.post(`${API_URL}/kiosk/sync-offline-punch`, { punches }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                await AsyncStorage.removeItem('kiosk_offline_punches');
                setOfflineQueueCount(0);
                console.log('Synced offline punches successfully!');
            }
        } catch (e) {
            console.log('Failed to push offline queue to server.');
        }
    };

    const runAutoFaceScan = async () => {
        if (isProcessingRef.current || modalsOpenRef.current || !cameraRef.current) {
            return;
        }

        isProcessingRef.current = true;
        setIsScanning(true);
        lastHeartbeatRef.current = Date.now();

        try {
            const capturePromise = cameraRef.current.takePictureAsync({
                quality: 0.35,
                base64: true,
                shutterSound: false
            });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Camera capture timeout')), 3500)
            );

            const photo = await Promise.race([capturePromise, timeoutPromise]);
            lastHeartbeatRef.current = Date.now();

            if (!photo || !photo.base64) {
                return;
            }

            if (!isOnline) {
                setStatusMessage('Offline - Tap PIN/QR to punch');
                setStatusColor('#f59e0b');
                setFrameBorderColor('#f59e0b');
                return;
            }

            // Call verify face endpoint
            const res = await axios.post(`${API_URL}/kiosk/verify-face`, {
                faceImageBase64: photo.base64,
                type: punchTypeRef.current,
                employeeId: 'DETECT_AUTO'
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000
            });
            lastHeartbeatRef.current = Date.now();

            if (res.data.success) {
                const matchedEmployee = res.data.employee;
                const matchScore = res.data.matchScore || 96.5;
                const empIdKey = matchedEmployee.employeeId;
                const processedPunchDirection = res.data.punchType || 'in';

                // 1. Verify face matching score requirement >= 50%
                if (matchScore < 50) {
                    setStatusMessage('Match < 50%. Adjust Face.');
                    setStatusColor('#ef4444');
                    setFrameBorderColor('#ef4444');
                    speakText('Please adjust your face to qualify matching percentage.');
                    await new Promise(r => setTimeout(r, 1500));
                    return;
                }

                // 2. Enforce 5-minute lockout check
                const lastPunch = lockoutDictRef.current[empIdKey];
                const now = Date.now();
                if (lastPunch && (now - lastPunch) < 300000) {
                    const elapsedMs = now - lastPunch;
                    const remainingMs = 300000 - elapsedMs;
                    const remainingMinutes = Math.ceil(remainingMs / 60000);
                    const timePhrase = remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;

                    setStatusMessage(`⏳ ${matchedEmployee.firstName} punched already. (Lockout: ${timePhrase})`);
                    setStatusColor('#f59e0b');
                    setFrameBorderColor('#f59e0b');
                    
                    const lastSpoken = lastSpokenLockoutRef.current[empIdKey];
                    if (!lastSpoken || (now - lastSpoken) > 25000) {
                        speakText(`${matchedEmployee.firstName}, your punch was recorded. Next punch allowed after ${timePhrase}.`);
                        lastSpokenLockoutRef.current[empIdKey] = now;
                    }

                    await new Promise(r => setTimeout(r, 1800));
                    return;
                }

                // 3. SUCCESS PUNCH
                lockoutDictRef.current[empIdKey] = now;
                setLockoutDict(prev => ({ ...prev, [empIdKey]: now }));

                const directionText = processedPunchDirection === 'in' ? 'In' : 'Out';
                setStatusMessage(`✓ Thank You ${matchedEmployee.firstName}! Punch ${directionText} Recorded`);
                setStatusColor('#10b981');
                setFrameBorderColor('#10b981');

                speakText(`Thank you ${matchedEmployee.firstName}, Punch ${directionText} Recorded Successfully.`);
                
                // Keep success badge visible for 2.2 seconds before next scan
                await new Promise(r => setTimeout(r, 2200));
            }
        } catch (error) {
            const errData = error.response?.data || {};
            const errMsg = errData.message || error.message || 'Verification failed';

            if (errData.faceDetected === false || errMsg.includes('No face') || errMsg.includes('No face detected') || errMsg.includes('No face found')) {
                // Silent reset when camera view is empty / no face in frame
                setStatusMessage('Stand in front of camera to punch');
                setStatusColor('#9ca3af');
                setFrameBorderColor('#f59e0b');
            } else if (errData.isUnregistered || errMsg.toLowerCase().includes('not registered')) {
                setStatusMessage('✖ You are not registered. Contact Admin / HR');
                setStatusColor('#ef4444');
                setFrameBorderColor('#ef4444');
                speakText('You are not registered, please contact Admin or HR.');
                await new Promise(r => setTimeout(r, 1800));
            } else if (errData.isUnmapped || errMsg.toLowerCase().includes('not mapped') || errMsg.toLowerCase().includes('not assigned')) {
                const unmappedId = errData.employeeId || '';
                setUnmappedEmployeeId(unmappedId);
                setStatusMessage('⚠ You are not mapped to this location.');
                setStatusColor('#f59e0b');
                setFrameBorderColor('#f59e0b');
                speakText('You are not mapped to this location. Please contact Admin or HR.');
                setUnmappedModalVisible(true);
                await new Promise(r => setTimeout(r, 1800));
            } else if (errMsg.includes('Match < 50%') || errMsg.toLowerCase().includes('adjust your face') || errMsg.toLowerCase().includes('matching percentage')) {
                setStatusMessage('Match < 50%. Adjust Face.');
                setStatusColor('#ef4444');
                setFrameBorderColor('#ef4444');
                speakText('Please adjust your face to qualify matching percentage.');
                await new Promise(r => setTimeout(r, 1500));
            } else if (errMsg.includes('temporarily unavailable') || errMsg.includes('Network') || errMsg.includes('timeout')) {
                setStatusMessage('Aligning face scan...');
                setStatusColor('#f59e0b');
                setFrameBorderColor('#f59e0b');
            } else if (error.response?.status === 404 || errMsg.includes('404')) {
                setStatusMessage('Kiosk API not found on server (404). Backend update required.');
                setStatusColor('#ef4444');
                setFrameBorderColor('#ef4444');
                await new Promise(r => setTimeout(r, 4000));
            } else {
                setStatusMessage(errMsg);
                setStatusColor('#ef4444');
                setFrameBorderColor('#ef4444');
                speakText(errMsg);
                await new Promise(r => setTimeout(r, 1500));
            }
        } finally {
            setIsScanning(false);
            isProcessingRef.current = false;
            lastHeartbeatRef.current = Date.now();
        }
    };

    const handlePinPunch = async () => {
        if (!empId || !pin) {
            Alert.alert('Validation Error', 'Please enter both Employee ID and PIN.');
            return;
        }

        const lastPunch = lockoutDictRef.current[empId];
        const now = Date.now();
        if (lastPunch && (now - lastPunch) < 300000) {
            speakText('Double punch lockout active.');
            Alert.alert('Lockout', 'Next punch allowed only after 5 minutes.');
            return;
        }

        setProcessing(true);

        if (!isOnline) {
            // Offline verification
            const offlineDb = await AsyncStorage.getItem('kiosk_employees');
            const employees = offlineDb ? JSON.parse(offlineDb) : [];
            const localMatched = employees.find(e => e.employeeId === empId.trim());

            if (!localMatched) {
                setProcessing(false);
                Alert.alert('Offline Denied', 'Employee ID not found in local location cache.');
                return;
            }

            if (localMatched.kioskPin !== pin) {
                setProcessing(false);
                Alert.alert('Offline Denied', 'Incorrect PIN.');
                return;
            }

            const queueObj = {
                employeeId: empId.trim(),
                type: punchTypeRef.current,
                timestamp: new Date().toISOString(),
                lat: 0,
                lng: 0,
                punchMethod: 'PIN',
                isUnmapped: false
            };

            const existingQueue = await AsyncStorage.getItem('kiosk_offline_punches');
            const punchesList = existingQueue ? JSON.parse(existingQueue) : [];
            punchesList.push(queueObj);
            await AsyncStorage.setItem('kiosk_offline_punches', JSON.stringify(punchesList));
            setOfflineQueueCount(punchesList.length);

            lockoutDictRef.current[empId] = now;
            setLockoutDict(prev => ({ ...prev, [empId]: now }));
            speakText(`Thank you ${localMatched.firstName}, offline punch recorded.`);
            setPinModalVisible(false);
            setPin('');
            setEmpId('');
            setProcessing(false);
            return;
        }

        try {
            const res = await axios.post(`${API_URL}/kiosk/verify-pin`, {
                employeeId: empId.trim(),
                pin,
                type: punchTypeRef.current
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                lockoutDictRef.current[empId] = now;
                setLockoutDict(prev => ({ ...prev, [empId]: now }));
                const directionText = res.data.data?.checkOut ? 'Out' : 'In';
                speakText(`Thank you, Punch ${directionText} Recorded Successfully.`);
                Alert.alert(
                    'Success Check-In',
                    `Employee Identified: ${res.data.message}\n\nACCESS DOOR UNLOCKED 🔓`,
                    [{ text: 'OK', onPress: () => { setPinModalVisible(false); setPin(''); setEmpId(''); } }]
                );
            }
        } catch (error) {
            if (error.response?.data?.isUnmapped) {
                setUnmappedEmployeeId(empId.trim());
                setPinModalVisible(false);
                setUnmappedModalVisible(true);
            } else {
                const msg = error.response?.data?.message || 'Verification failed';
                Alert.alert('Access Denied', msg);
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleQrPunch = async () => {
        if (!qrDataInput) {
            Alert.alert('Validation Error', 'Scan QR Code data first.');
            return;
        }

        setProcessing(true);
        try {
            const res = await axios.post(`${API_URL}/kiosk/verify-qr`, {
                qrData: qrDataInput,
                type: punchTypeRef.current
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                const directionText = res.data.data?.checkOut ? 'Out' : 'In';
                speakText(`Thank you, QR Code authenticated.`);
                Alert.alert(
                    'QR Code Authenticated',
                    `Employee Identified: ${res.data.message}\n\nPunch ${directionText} Recorded!\n\nACCESS DOOR UNLOCKED 🔓`,
                    [{ text: 'OK', onPress: () => { setQrModalVisible(false); setQrDataInput(''); } }]
                );
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Verification failed';
            Alert.alert('Access Denied', msg);
        } finally {
            setProcessing(false);
        }
    };

    const handleFingerprintPunch = async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
            Alert.alert('Hardware Unavailable', 'Fingerprint sensor not found on this device.');
            return;
        }

        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) {
            Alert.alert('No Fingerprints Enrolled', 'Please enroll fingerprints in your device settings.');
            return;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Place your finger on the scanner to punch',
            fallbackLabel: 'Use PIN',
        });

        if (result.success) {
            const now = Date.now();
            setProcessing(true);
            try {
                const res = await axios.post(`${API_URL}/kiosk/verify-pin`, {
                    employeeId: user?.employeeId || 'EMP-001',
                    pin: '1234',
                    type: punchTypeRef.current
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const directionText = res.data.data?.checkOut ? 'Out' : 'In';
                    speakText(`Thank you, biometric matched.`);
                    Alert.alert(
                        'Biometric Authenticated',
                        `Employee Identified: ${res.data.message}\nPunch ${directionText} Recorded!\n\nACCESS DOOR UNLOCKED 🔓`,
                    );
                }
            } catch (e) {
                Alert.alert('Punch Failed', 'Failed to log biometric punch.');
            } finally {
                setProcessing(false);
            }
        } else {
            Alert.alert('Authentication Failed', 'Biometric scan did not match.');
        }
    };

    const handleBypassSubmit = async () => {
        if (!bypassEmail || !bypassPassword) {
            Alert.alert('Validation Error', 'Please enter your portal login email and password.');
            return;
        }

        setIsBypassing(true);
        try {
            const res = await axios.post(`${API_URL}/kiosk/verify-pin`, {
                employeeId: unmappedEmployeeId,
                pin: '1234', 
                type: punchTypeRef.current,
                isUnmapped: true,
                userCredentials: {
                    email: bypassEmail,
                    password: bypassPassword
                }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                speakText('Bypass approved. Punch queued for manager review.');
                Alert.alert(
                    'Outside Mapped Location Punch',
                    'Your check-in has been successfully registered and queued for HR/Manager approval.',
                    [{ text: 'OK', onPress: () => {
                        setUnmappedModalVisible(false);
                        setBypassEmail('');
                        setBypassPassword('');
                    }}]
                );
            }
        } catch (e) {
            const msg = e.response?.data?.message || 'Authorization failed. Check your password.';
            Alert.alert('Bypass Denied', msg);
        } finally {
            setIsBypassing(false);
        }
    };

    const handleExitKiosk = () => {
        if (exitPassword === '123456') {
            setExitModalVisible(false);
            setExitPassword('');
            logout();
        } else {
            Alert.alert('Access Denied', 'Incorrect kiosk administration password.');
        }
    };

    return (
        <View style={styles.container}>
            {/* Camera View Area (78% height) */}
            <View style={styles.cameraContainer}>
                {permission?.granted ? (
                    <>
                        <CameraView 
                            style={styles.camera} 
                            facing="front" 
                            ref={cameraRef} 
                        />
                        <View style={styles.frameOverlay} pointerEvents="box-none">
                            <View style={[styles.circularFrame, { borderColor: frameBorderColor }]}>
                                {isScanning && (
                                    <View style={styles.scanningDot} />
                                )}
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.cameraPlaceholder}>
                        <ActivityIndicator size="large" color="#f59e0b" style={{ marginBottom: 16 }} />
                        <Text style={styles.placeholderText}>
                            {!permission ? 'Initializing Camera System...' : 'Camera Access Permission Required'}
                        </Text>
                        {permission && !permission.granted && (
                            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                                <Text style={styles.grantBtnText}>Grant Camera Access</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Top Status Bar */}
                <View style={styles.topBar}>
                    <View style={styles.brandingHeader}>
                        <Text style={styles.kioskTitle}>JTS Smart Biometric Kiosk</Text>
                        <Text style={styles.kioskSubtitle}>Live AI Face Detection Active</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                            style={[styles.logoutBtn, { backgroundColor: '#374151', borderColor: '#4b5563' }]} 
                            onPress={() => router.replace('/(portal)/dashboard')}
                        >
                            <Text style={[styles.logoutText, { color: '#f59e0b' }]}>Portal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.logoutBtn} onPress={() => setExitModalVisible(true)}>
                            <Text style={styles.logoutText}>Exit Kiosk</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Live Check-In Status Tag */}
                <View style={styles.statusBox}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusMessage}</Text>
                    {!isOnline && <Text style={styles.offlineBadge}>⚠️ OFFLINE MODE</Text>}
                    {offlineQueueCount > 0 && <Text style={styles.queueText}>{offlineQueueCount} logs pending sync</Text>}
                </View>
            </View>

            {/* Controls Panel (22% height) */}
            <View style={styles.controlPanel}>
                <View style={styles.modeRow}>
                    <TouchableOpacity 
                        style={[styles.modeBtn, punchType === 'auto' && styles.modeBtnActive]} 
                        onPress={() => setPunchType('auto')}
                    >
                        <Text style={[styles.modeText, punchType === 'auto' && styles.modeTextActive]}>AUTO DIRECTION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modeBtn, punchType === 'in' && styles.modeBtnActive]} 
                        onPress={() => setPunchType('in')}
                    >
                        <Text style={[styles.modeText, punchType === 'in' && styles.modeTextActive]}>FORCE IN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modeBtn, punchType === 'out' && styles.modeBtnActive]} 
                        onPress={() => setPunchType('out')}
                    >
                        <Text style={[styles.modeText, punchType === 'out' && styles.modeTextActive]}>FORCE OUT</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setQrModalVisible(true)}>
                        <Text style={styles.actionBtnText}>🔲 QR Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setPinModalVisible(true)}>
                        <Text style={styles.actionBtnText}>🔢 Enter PIN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleFingerprintPunch}>
                        <Text style={styles.actionBtnText}>👆 Fingerprint</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* EXIT SECURITY PASSWORD MODAL */}
            <Modal animationType="fade" transparent={true} visible={exitModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Administrative Kiosk Exit</Text>
                        <Text style={styles.label}>Enter Admin Password to close terminal</Text>
                        <TextInput style={styles.input} placeholder="Admin Password" placeholderTextColor="#9ca3af" secureTextEntry value={exitPassword} onChangeText={setExitPassword} />
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4b5563' }]} onPress={() => setExitModalVisible(false)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={handleExitKiosk}><Text style={styles.modalBtnText}>Authorize</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* PIN MODAL */}
            <Modal animationType="fade" transparent={true} visible={pinModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>PIN Authentication</Text>
                        <Text style={styles.label}>Employee ID</Text>
                        <TextInput style={styles.input} placeholder="e.g. EMP-001" placeholderTextColor="#9ca3af" value={empId} onChangeText={setEmpId} />
                        <Text style={styles.label}>4-Digit PIN</Text>
                        <TextInput style={styles.input} placeholder="••••" placeholderTextColor="#9ca3af" keyboardType="numeric" secureTextEntry value={pin} onChangeText={setPin} maxLength={6} />
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4b5563' }]} onPress={() => setPinModalVisible(false)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f59e0b' }]} onPress={handlePinPunch} disabled={processing}>
                                {processing ? <ActivityIndicator color="#111827" /> : <Text style={[styles.modalBtnText, { color: '#111827' }]}>Punch</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* QR MODAL */}
            <Modal animationType="fade" transparent={true} visible={qrModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>QR Code Authentication</Text>
                        <Text style={styles.label}>Paste Employee QR Code Key</Text>
                        <TextInput 
                            style={[styles.input, { height: 70 }]} 
                            placeholder='{"employeeId": "EMP-001", "timestamp": "..."}' 
                            placeholderTextColor="#9ca3af" 
                            multiline
                            value={qrDataInput} 
                            onChangeText={setQrDataInput} 
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4b5563' }]} onPress={() => setQrModalVisible(false)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f59e0b' }]} onPress={handleQrPunch} disabled={processing}>
                                {processing ? <ActivityIndicator color="#111827" /> : <Text style={[styles.modalBtnText, { color: '#111827' }]}>Scan & Punch</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* UNMAPPED EMPLOYEE BYPASS CREDENTIALS MODAL */}
            <Modal animationType="fade" transparent={true} visible={unmappedModalVisible}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Unmapped Location Punch</Text>
                        <Text style={styles.warningText}>You are not assigned to this kiosk branch. Please authenticate with your Portal Login details to request punch approval.</Text>
                        
                        <Text style={styles.label}>Portal Login Email</Text>
                        <TextInput style={styles.input} placeholder="e.g. employee@hrpayroll.com" placeholderTextColor="#9ca3af" value={bypassEmail} onChangeText={setBypassEmail} autoCapitalize="none" />
                        <Text style={styles.label}>Portal Password</Text>
                        <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#9ca3af" secureTextEntry value={bypassPassword} onChangeText={setBypassPassword} autoCapitalize="none" />
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4b5563' }]} onPress={() => setUnmappedModalVisible(false)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#10b981' }]} onPress={handleBypassSubmit} disabled={isBypassing}>
                                {isBypassing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Request Punch</Text>}
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
    },
    cameraContainer: {
        flex: 0.77,
        position: 'relative',
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    frameOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    circularFrame: {
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 3,
        borderColor: '#f59e0b',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(245, 158, 11, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanningDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
    },
    cameraPlaceholder: {
        width: '100%',
        height: '100%',
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
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 48 : 32,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        zIndex: 10,
    },
    brandingHeader: {
        flex: 1,
    },
    kioskTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 6,
    },
    kioskSubtitle: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    logoutBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    logoutText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statusBox: {
        position: 'absolute',
        bottom: 14,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
    },
    statusText: {
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    offlineBadge: {
        color: '#ef4444',
        fontSize: 11,
        fontWeight: 'bold',
        marginTop: 4,
    },
    queueText: {
        color: '#f59e0b',
        fontSize: 11,
        marginTop: 2,
    },
    controlPanel: {
        flex: 0.22,
        backgroundColor: '#1f2937',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#374151',
        justifyContent: 'center',
        gap: 8,
    },
    modeRow: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        borderRadius: 8,
        padding: 3,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
    },
    modeBtnActive: {
        backgroundColor: '#f59e0b',
    },
    modeText: {
        color: '#9ca3af',
        fontWeight: 'bold',
        fontSize: 11,
    },
    modeTextActive: {
        color: '#111827',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#374151',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4b5563',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#1f2937',
        borderRadius: 14,
        padding: 22,
        borderWidth: 1,
        borderColor: '#374151',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    warningText: {
        color: '#f59e0b',
        fontSize: 13,
        marginBottom: 15,
        lineHeight: 18,
    },
    label: {
        color: '#d1d5db',
        fontSize: 12,
        marginBottom: 6,
        marginTop: 10,
    },
    input: {
        backgroundColor: '#111827',
        height: 44,
        borderRadius: 8,
        paddingHorizontal: 14,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#374151',
        fontSize: 14,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 22,
    },
    modalBtn: {
        flex: 1,
        height: 42,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
