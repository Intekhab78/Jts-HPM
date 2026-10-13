import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, Text, TextInput, TouchableOpacity, View, 
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView 
} from 'react-native';
import { useAuth } from './_layout';
import axios from 'axios';
import { 
    getApiUrl, setApiUrl, resetApiUrl, normalizeApiUrl,
    DEFAULT_SERVER_URL, SECONDARY_SERVER_URL 
} from '../config';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    // Server Configuration Modal States
    const [serverModalVisible, setServerModalVisible] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(getApiUrl());
    const [inputUrl, setInputUrl] = useState(getApiUrl());
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        setCurrentUrl(getApiUrl());
        setInputUrl(getApiUrl());
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Validation Error', 'Please fill in both Email and Password fields.');
            return;
        }

        setLoading(true);
        const apiUrl = getApiUrl();

        try {
            const res = await axios.post(`${apiUrl}/auth/login`, {
                email: email.trim().toLowerCase(),
                password
            }, { timeout: 10000 });

            if (res.data?.success) {
                const { accessToken, user } = res.data.data;
                await login(accessToken, user);
            } else if (typeof res.data === 'string' && (res.data.includes('<!doctype') || res.data.includes('<html'))) {
                Alert.alert(
                    'Incorrect API Endpoint',
                    'This URL returned the Web Portal HTML page instead of API JSON.\n\nPlease open "⚙️ Server Settings" and switch to "Cloud (jtsonline)" which hosts the active API.'
                );
            } else {
                Alert.alert('Login Failed', res.data?.message || 'Incorrect credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            const serverMsg = error.response?.data?.message;
            if (serverMsg) {
                Alert.alert('Login Failed', serverMsg);
            } else {
                const targetHost = apiUrl.replace(/^https?:\/\//, '');
                Alert.alert(
                    'Network / Connection Error', 
                    `Cannot reach backend server at:\n${targetHost}\n\nPlease verify your internet connection or check the Server Settings below.`
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTestConnection = async (testTarget) => {
        const url = normalizeApiUrl(testTarget || inputUrl);
        if (!url) {
            Alert.alert('Error', 'Please enter a server URL to test.');
            return;
        }
        setTesting(true);
        setTestResult(null);

        try {
            // Test reachability by pinging auth endpoint with timeout
            const res = await axios.post(`${url}/auth/login`, {}, { timeout: 6000 });
            if (typeof res.data === 'string' && (res.data.includes('<!doctype') || res.data.includes('<html'))) {
                setTestResult({
                    success: false,
                    message: '⚠️ Warning: Endpoint returned Web Portal HTML instead of API JSON.'
                });
            } else {
                setTestResult({ success: true, message: `Connected! Server responded with HTTP ${res.status}` });
            }
        } catch (err) {
            if (err.response) {
                if (typeof err.response.data === 'string' && (err.response.data.includes('<!doctype') || err.response.data.includes('<html'))) {
                    setTestResult({
                        success: false,
                        message: '⚠️ Warning: Server returned Web Portal HTML instead of API.'
                    });
                } else {
                    setTestResult({ 
                        success: true, 
                        message: `Connected! Reachable at ${url.replace(/^https?:\/\//, '')} (HTTP ${err.response.status})` 
                    });
                }
            } else {
                setTestResult({ 
                    success: false, 
                    message: `Cannot reach ${url}. (${err.message || 'Timed out'})` 
                });
            }
        } finally {
            setTesting(false);
        }
    };

    const handleSaveServer = async () => {
        const clean = normalizeApiUrl(inputUrl);
        if (!clean) {
            Alert.alert('Error', 'URL cannot be empty');
            return;
        }
        await setApiUrl(clean);
        setCurrentUrl(clean);
        setInputUrl(clean);
        setServerModalVisible(false);
        Alert.alert('Server Updated', `Active API URL:\n${clean}`);
    };

    const handleSelectPreset = (presetUrl) => {
        setInputUrl(presetUrl);
        handleTestConnection(presetUrl);
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
        >
            <View style={styles.card}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>HR</Text>
                </View>
                <Text style={styles.title}>HR Payroll System</Text>
                <Text style={styles.subtitle}>Android & iOS Mobile Client Portal</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Corporate Email</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="email@company.com"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                </View>

                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#111827" />
                    ) : (
                        <Text style={styles.buttonText}>Log In</Text>
                    )}
                </TouchableOpacity>

                {/* Server Configuration Link */}
                <TouchableOpacity 
                    style={styles.serverSettingsBtn} 
                    onPress={() => {
                        setInputUrl(getApiUrl());
                        setTestResult(null);
                        setServerModalVisible(true);
                    }}
                >
                    <Text style={styles.serverSettingsText}>⚙️ Server Settings</Text>
                    <Text style={styles.serverHostPreview} numberOfLines={1}>
                        {currentUrl.replace(/^https?:\/\//, '')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Server Settings Modal */}
            <Modal
                visible={serverModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setServerModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>⚙️ Server Configuration</Text>
                        <Text style={styles.modalSubtitle}>
                            Configure backend server address for Cloud or Local access.
                        </Text>

                        <Text style={styles.presetLabel}>Quick Presets:</Text>
                        <View style={styles.presetRow}>
                            <TouchableOpacity 
                                style={[styles.presetChip, styles.presetChipActive]}
                                onPress={() => handleSelectPreset(DEFAULT_SERVER_URL)}
                            >
                                <Text style={styles.presetChipText}>Cloud (hcmapi.jtsmiddleeast)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.presetChip}
                                onPress={() => handleSelectPreset(SECONDARY_SERVER_URL)}
                            >
                                <Text style={styles.presetChipText}>Cloud (jtsonline)</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>API Server Endpoint</Text>
                        <TextInput 
                            style={styles.input}
                            value={inputUrl}
                            onChangeText={setInputUrl}
                            placeholder="https://yourserver.com/api"
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {/* Test Status Indicator */}
                        {testing && (
                            <View style={styles.statusBox}>
                                <ActivityIndicator size="small" color="#f59e0b" />
                                <Text style={styles.statusTextTesting}>Testing connection...</Text>
                            </View>
                        )}
                        {testResult && (
                            <View style={[styles.statusBox, testResult.success ? styles.statusBoxSuccess : styles.statusBoxError]}>
                                <Text style={testResult.success ? styles.statusTextSuccess : styles.statusTextError}>
                                    {testResult.message}
                                </Text>
                            </View>
                        )}

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, styles.testBtn]}
                                onPress={() => handleTestConnection()}
                                disabled={testing}
                            >
                                <Text style={styles.testBtnText}>Test Connection</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handleSaveServer}
                            >
                                <Text style={styles.saveBtnText}>Save & Apply</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={styles.cancelBtn}
                            onPress={() => setServerModalVisible(false)}
                        >
                            <Text style={styles.cancelBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1f2937',
        padding: 30,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
    },
    logoContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    logoText: {
        color: '#111827',
        fontSize: 22,
        fontWeight: 'bold',
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: 14,
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 48,
        backgroundColor: '#111827',
        borderRadius: 8,
        paddingHorizontal: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#374151',
    },
    button: {
        width: '100%',
        height: 48,
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#111827',
        fontSize: 16,
        fontWeight: 'bold',
    },
    serverSettingsBtn: {
        marginTop: 24,
        alignItems: 'center',
        paddingVertical: 8,
    },
    serverSettingsText: {
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: '600',
    },
    serverHostPreview: {
        color: '#f59e0b',
        fontSize: 11,
        marginTop: 3,
        maxWidth: 260,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 16,
    },
    presetLabel: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    presetChip: {
        backgroundColor: '#374151',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#4b5563',
    },
    presetChipActive: {
        borderColor: '#f59e0b',
        backgroundColor: '#1f2937',
    },
    presetChipText: {
        color: '#e5e7eb',
        fontSize: 12,
        fontWeight: '500',
    },
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginTop: 12,
        backgroundColor: '#111827',
    },
    statusBoxSuccess: {
        backgroundColor: '#064e3b',
    },
    statusBoxError: {
        backgroundColor: '#7f1d1d',
    },
    statusTextTesting: {
        color: '#f59e0b',
        fontSize: 13,
        marginLeft: 8,
    },
    statusTextSuccess: {
        color: '#34d399',
        fontSize: 13,
        fontWeight: '500',
    },
    statusTextError: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '500',
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    modalBtn: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    testBtn: {
        backgroundColor: '#374151',
        borderWidth: 1,
        borderColor: '#4b5563',
    },
    testBtnText: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: '#f59e0b',
    },
    saveBtnText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: 'bold',
    },
    cancelBtn: {
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 10,
    },
    cancelBtnText: {
        color: '#9ca3af',
        fontSize: 14,
    },
});
