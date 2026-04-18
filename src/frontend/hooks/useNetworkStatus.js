import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import useNetworkStore from '../store/networkStore';

/**
 * useNetworkStatus Hook
 *
 * Subscribes to real-time network connectivity changes.
 * When the device goes offline → sets isOffline = true in networkStore.
 * When connectivity is restored → sets isOffline = false.
 *
 * This works alongside the Axios timeout interceptor:
 *  - Axios interceptor catches request-level timeouts
 *  - This hook catches device-level connectivity changes
 *
 * Usage: call once in the root layout/component.
 */
export default function useNetworkStatus() {
    const setOffline = useNetworkStore((state) => state.setOffline);
    const setOnline = useNetworkStore((state) => state.setOnline);

    useEffect(() => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable !== false) {
                setOnline();
            } else {
                setOffline();
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [setOffline, setOnline]);
}
