/**
 * delivery-map.web.tsx — lazy wrapper around LeafletDeliveryMap.
 *
 * Leaflet accesses `window` at import time, which crashes Metro's server-side
 * pre-pass. By lazy-loading the component behind a `mounted` gate we ensure
 * the Leaflet module is only evaluated after first client render.
 */
import { Colors, Spacing } from "@/constants/theme";
import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const LeafletDeliveryMap = React.lazy(
    () => import("@/components/LeafletDeliveryMap"),
);

function LoadingScreen() {
    return (
        <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accentSage} />
            <Text style={styles.loadingText}>Loading map…</Text>
        </View>
    );
}

export default function DeliveryMapScreen() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);


    return (
        <Suspense fallback={<LoadingScreen />}>
            <LeafletDeliveryMap />
        </Suspense>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.background,
        padding: Spacing.xl,
    },
    loadingText: {
        marginTop: 12,
        color: Colors.textSecondary,
        fontSize: 15,
    },
});
