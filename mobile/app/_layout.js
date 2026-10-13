import { Stack, useRouter, useSegments } from 'expo-router';
import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';
import axios from 'axios';
import { initApiConfig } from '../config';

const AuthContext = createContext({
    user: null,
    token: null,
    login: () => {},
    logout: () => {}
});

export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        loadSession();

        // Global Axios interceptor for expired tokens
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    const msg = error.response.data?.message || '';
                    if (msg.includes('token') || msg.includes('authorized') || msg.includes('expired')) {
                        console.warn('Session expired - clearing invalid token.');
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(portal)' || segments[0] === 'kiosk';
        
        if (!token && inAuthGroup) {
            // Redirect to Login if not authenticated
            router.replace('/');
        } else if (token && segments[0] === undefined) {
            // Redirect to Portal or Kiosk if logged in
            if (user?.role?.name === 'kiosk' || user?.email?.includes('kiosk') || user?.deviceRef) {
                router.replace('/kiosk');
            } else {
                router.replace('/(portal)/dashboard');
            }
        }
    }, [token, segments, loading]);

    const loadSession = async () => {
        try {
            await initApiConfig();
            const savedToken = await SecureStore.getItemAsync('token');
            const savedUser = await SecureStore.getItemAsync('user');
            if (savedToken && savedUser) {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            }
        } catch (e) {
            console.error('Failed to load session', e);
        } finally {
            setLoading(false);
        }
    };

    const login = async (userToken, userData) => {
        try {
            await SecureStore.setItemAsync('token', userToken);
            await SecureStore.setItemAsync('user', JSON.stringify(userData));
        } catch (e) {
            console.error('SecureStore login write failed', e);
        }
        setToken(userToken);
        setUser(userData);
    };

    const logout = async () => {
        try {
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('user');
        } catch (e) {
            console.error('SecureStore logout delete failed', e);
        }
        setToken(null);
        setUser(null);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
                <ActivityIndicator size="large" color="#f59e0b" />
            </View>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(portal)" />
                <Stack.Screen name="kiosk" />
            </Stack>
        </AuthContext.Provider>
    );
}
