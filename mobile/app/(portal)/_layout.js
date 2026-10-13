import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { View, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';

export default function PortalLayout() {
    const { logout, user, token } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!token) {
            router.replace('/');
        }
    }, [token]);

    return (
        <Tabs screenOptions={{
            tabBarStyle: {
                backgroundColor: '#1f2937',
                borderTopColor: '#374151',
                height: 60,
                paddingBottom: 8,
                paddingTop: 8,
            },
            tabBarActiveTintColor: '#f59e0b',
            tabBarInactiveTintColor: '#9ca3af',
            headerStyle: {
                backgroundColor: '#1f2937',
                borderBottomColor: '#374151',
                borderBottomWidth: 1,
            },
            headerTitleStyle: {
                color: '#fff',
                fontSize: 18,
                fontWeight: 'bold',
            },
            headerRight: () => (
                <TouchableOpacity onPress={logout} style={{ marginRight: 15, padding: 6, backgroundColor: '#374151', borderRadius: 4 }}>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Log Out</Text>
                </TouchableOpacity>
            ),
        }}>
            <Tabs.Screen 
                name="dashboard" 
                options={{
                    title: 'Dashboard',
                    headerTitle: `Welcome, ${user?.name || 'User'}`,
                }} 
            />
            <Tabs.Screen 
                name="leaves" 
                options={{
                    title: 'Leaves',
                    headerTitle: 'Leaves Management',
                }} 
            />
            <Tabs.Screen 
                name="loans" 
                options={{
                    title: 'Advances',
                    headerTitle: 'Salary Advances',
                }} 
            />
            <Tabs.Screen 
                name="history" 
                options={{
                    title: 'History',
                    headerTitle: 'Attendance History',
                }} 
            />
        </Tabs>
    );
}
