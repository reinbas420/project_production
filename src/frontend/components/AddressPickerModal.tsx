import locationService from "@/api/services/locationService";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface DeliveryAddress {
  _id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  location?: {
    type: string;
    coordinates: number[];
  };
}

interface AddressPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: DeliveryAddress) => void;
}

export default function AddressPickerModal({
  visible,
  onClose,
  onSelect,
}: AddressPickerModalProps) {
  const { userId } = useAppStore();
  const router = useRouter();

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch saved addresses when modal opens
  useEffect(() => {
    if (visible && userId) {
      fetchAddresses();
    }
  }, [visible, userId]);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const res: any = await locationService.getDeliveryAddresses(userId!);
      const addresses = res?.data?.addresses ?? res?.addresses ?? [];
      setAddresses(addresses);
    } catch (err) {
      console.warn("Failed to fetch addresses", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAddress = (addr: DeliveryAddress) => {
    onSelect(addr);
    onClose();
  };

  const handleAddNewAddress = () => {
    onClose();
    // Navigate to the delivery map to pick a new location
    router.push("/(user)/delivery-map");
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await locationService.deleteDeliveryAddress(userId!, addressId);
      setAddresses((prev) => prev.filter((a) => a._id !== addressId));
    } catch (err) {
      console.warn("Failed to delete address", err);
    }
  };

  const formatAddress = (addr: DeliveryAddress) => {
    const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(
      Boolean,
    );
    return parts.join(", ") || "Unknown location";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Delivery Address</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.accentSage} />
              <Text style={styles.loadingText}>Loading addresses…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
            >
              {/* Saved addresses */}
              {addresses.length > 0 ? (
                addresses.map((addr) => (
                  <TouchableOpacity
                    key={addr._id}
                    style={[
                      styles.addressCard,
                      addr.isDefault && styles.addressCardDefault,
                    ]}
                    onPress={() => handleSelectAddress(addr)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.addressContent}>
                      <View style={styles.labelRow}>
                        <Text style={styles.addressLabel}>
                          📍 {addr.label || "Saved"}
                        </Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressText} numberOfLines={2}>
                        {formatAddress(addr)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteAddress(addr._id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📭</Text>
                  <Text style={styles.emptyText}>
                    No saved addresses yet.{"\n"}Add one to get started!
                  </Text>
                </View>
              )}

              {/* Add new address button */}
              <TouchableOpacity
                style={styles.addNewBtn}
                onPress={handleAddNewAddress}
                activeOpacity={0.8}
              >
                <Text style={styles.addNewIcon}>＋</Text>
                <Text style={styles.addNewText}>Add a new address</Text>
              </TouchableOpacity>

              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  title: {
    fontSize: Typography.body + 2,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  closeBtn: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: "700",
    padding: 4,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: Typography.label,
    color: Colors.textSecondary,
  },
  scrollArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  addressCardDefault: {
    borderColor: Colors.accentSage,
    backgroundColor: "#F0F8ED",
  },
  addressContent: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressLabel: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: Colors.accentSageLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  defaultBadgeText: {
    fontSize: Typography.label - 2,
    fontWeight: "700",
    color: Colors.accentSage,
  },
  addressText: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    gap: 8,
  },
  addNewIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.buttonPrimaryText,
  },
  addNewText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.buttonPrimaryText,
  },
});
