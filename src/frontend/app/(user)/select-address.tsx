import locationService from "@/api/services/locationService";
import { NavBar, NAV_BOTTOM_PAD } from "@/components/NavBar";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SelectAddressScreen() {
  const router = useRouter();
  const { userId, setHasDeliveryAddress } = useAppStore();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAddresses = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res: any = await locationService.getDeliveryAddresses(userId);
      const list = res.addresses || res.data?.addresses || [];
      setAddresses(list);
      // Auto-select the default one
      const def = list.find((a: any) => a.isDefault);
      if (def) setSelectedId(def._id);
      else if (list.length > 0) setSelectedId(list[0]._id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch every time the screen gains focus (e.g. coming back from delivery-map)
  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, []),
  );

  const handleConfirm = async () => {
    if (!selectedId || !userId) return;
    setSaving(true);
    try {
      await locationService.setDefaultAddress(userId, selectedId);
      setHasDeliveryAddress(true);
      router.replace("/(user)");
    } catch {
      // Even if setting default fails, proceed — the address exists
      setHasDeliveryAddress(true);
      router.replace("/(user)");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setHasDeliveryAddress(addresses.length > 0);
    router.replace("/(user)");
  };

  const handleAddNew = () => {
    router.push("/(user)/delivery-map?next=select-address");
  };

  return (
    <SafeAreaView style={st.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="profile" />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
      >
        <Text style={st.title}>Select Delivery Address</Text>
        <Text style={st.subtitle}>
          Choose your delivery address for ordering books. You can change this
          later in your profile settings.
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.accentSage}
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            {addresses.length === 0 ? (
              <View style={st.emptyWrap}>
                <Text style={st.emptyText}>
                  You don&apos;t have any saved addresses yet.
                </Text>
                <Text style={st.emptyHint}>
                  Add a delivery address to get started with ordering books.
                </Text>
              </View>
            ) : (
              addresses.map((addr: any) => (
                <TouchableOpacity
                  key={addr._id}
                  style={[
                    st.addrCard,
                    selectedId === addr._id && st.addrCardSelected,
                  ]}
                  activeOpacity={0.78}
                  onPress={() => setSelectedId(addr._id)}
                >
                  <View style={st.radioRow}>
                    <View
                      style={[
                        st.radio,
                        selectedId === addr._id && st.radioActive,
                      ]}
                    >
                      {selectedId === addr._id && (
                        <View style={st.radioInner} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text style={st.addrLabel}>
                          {addr.label || "Address"}
                        </Text>
                        {addr.isDefault && (
                          <View style={st.defaultBadge}>
                            <Text style={st.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.addrDetail}>
                        {[addr.street, addr.city, addr.state, addr.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Add new address */}
            <TouchableOpacity style={st.addBtn} onPress={handleAddNew}>
              <Text style={st.addBtnText}>+ Add New Address</Text>
            </TouchableOpacity>

            {/* Confirm / Skip */}
            <View style={st.actionRow}>
              {addresses.length > 0 && (
                <TouchableOpacity
                  style={[st.confirmBtn, saving && { opacity: 0.6 }]}
                  onPress={handleConfirm}
                  disabled={saving || !selectedId}
                  activeOpacity={0.82}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.buttonPrimaryText} />
                  ) : (
                    <Text style={st.confirmBtnText}>
                      Confirm &amp; Continue
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={st.skipBtn} onPress={handleSkip}>
                <Text style={st.skipBtnText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="profile" />}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, paddingBottom: NAV_BOTTOM_PAD },

  title: {
    fontSize: Typography.title + 4,
    fontWeight: "800",
    color: Colors.accentSage,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  addrCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  addrCardSelected: {
    borderColor: Colors.accentSage,
    backgroundColor: Colors.accentSageLight,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: Colors.accentSage,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentSage,
  },
  addrLabel: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  addrDetail: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  defaultBadge: {
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accentSage,
  },

  addBtn: {
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
  },
  addBtnText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.accentSage,
  },

  actionRow: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  confirmBtn: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: Typography.body,
    fontWeight: "800",
    color: Colors.buttonPrimaryText,
  },
  skipBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  skipBtnText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
