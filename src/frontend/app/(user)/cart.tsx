import cartService from '@/api/services/cartService';
import bookService from '@/api/services/bookService';
import axiosInstance from '@/api/axiosInstance';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CartItem = {
  book_id: string;
  quantity: number;
};

type CartPayload = {
  user_id: string;
  library_id: string | null;
  items: CartItem[];
};

type ItemWithBook = CartItem & {
  title: string;
  author: string;
};

export default function CartScreen() {
  const router = useRouter();
  const { activeProfileId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartPayload | null>(null);
  const [items, setItems] = useState<ItemWithBook[]>([]);
  const [updatingBookId, setUpdatingBookId] = useState<string | null>(null);
  const [cartLibraryName, setCartLibraryName] = useState<string>('');
  const [orderingAll, setOrderingAll] = useState(false);

  const totalCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const loadCart = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const res = await cartService.getCart();
      const nextCart: CartPayload = res?.data?.cart || {
        user_id: '',
        library_id: null,
        items: [],
      };
      setCart(nextCart);

      const hydrated = await Promise.all(
        (nextCart.items || []).map(async (item) => {
          try {
            const bookRes = await bookService.getBookById(item.book_id);
            const book = bookRes?.data?.book;
            return {
              ...item,
              title: book?.title || 'Unknown Book',
              author: book?.author || 'Unknown Author',
            };
          } catch {
            return {
              ...item,
              title: 'Unknown Book',
              author: 'Unknown Author',
            };
          }
        }),
      );

      setItems(hydrated);

      if (nextCart.library_id) {
        try {
          const librariesRes = await axiosInstance.get('/libraries');
          const libraries = Array.isArray(librariesRes?.data?.data?.libraries)
            ? librariesRes.data.data.libraries
            : [];
          const matched = libraries.find((library: any) => library._id === nextCart.library_id);
          setCartLibraryName(matched?.name || '');
        } catch {
          setCartLibraryName('');
        }
      } else {
        setCartLibraryName('');
      }
    } catch (error) {
      console.warn('Failed to load cart', error);
      if (showLoader) {
        setCart(null);
        setItems([]);
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const updateQuantity = async (bookId: string, operation: 'increment' | 'decrement') => {
    const prevItems = items;
    const prevCart = cart;

    // Optimistic UI update for immediate feedback
    if (operation === 'increment') {
      setItems((current) => current.map((item) => (
        item.book_id === bookId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )));
    } else {
      setItems((current) => current
        .map((item) => (
          item.book_id === bookId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        ))
        .filter((item) => item.quantity > 0));
    }

    if (prevCart) {
      const nextRawItems = operation === 'increment'
        ? (prevCart.items || []).map((item) => (
          item.book_id === bookId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
        : (prevCart.items || [])
          .map((item) => (
            item.book_id === bookId
              ? { ...item, quantity: item.quantity - 1 }
              : item
          ))
          .filter((item) => item.quantity > 0);

      setCart({
        ...prevCart,
        items: nextRawItems,
        library_id: nextRawItems.length > 0 ? prevCart.library_id : null,
      });
    }

    try {
      setUpdatingBookId(bookId);
      const response = await cartService.updateQuantity({
        book_id: bookId,
        operation,
      });

      const serverCart: CartPayload | undefined = response?.data?.cart;
      if (serverCart) {
        setCart(serverCart);

        const currentLookup = new Map(
          prevItems.map((item) => [item.book_id, item]),
        );

        const mergedItems: ItemWithBook[] = (serverCart.items || []).map((item) => {
          const existing = currentLookup.get(item.book_id);
          return {
            ...item,
            title: existing?.title || 'Unknown Book',
            author: existing?.author || 'Unknown Author',
          };
        });

        setItems(mergedItems);
      }
    } catch (error) {
      console.warn('Failed to update quantity', error);
      // Revert optimistic update on failure
      setItems(prevItems);
      if (prevCart) {
        setCart(prevCart);
      }
      Alert.alert('Error', 'Could not update quantity. Please try again.');
    } finally {
      setUpdatingBookId(null);
    }
  };

  const handleChangeQuantity = (bookId: string, operation: 'increment' | 'decrement') => {
    if (operation === 'increment') {
      updateQuantity(bookId, operation);
      return;
    }

    const targetItem = items.find((item) => item.book_id === bookId);
    if (!targetItem) {
      return;
    }

    if (targetItem.quantity > 1) {
      updateQuantity(bookId, operation);
      return;
    }

    if (Platform.OS === 'web') {
      const shouldDelete = typeof globalThis !== 'undefined'
        ? (globalThis as any).confirm?.(`Are you sure you want to delete "${targetItem.title}" from cart?`)
        : false;

      if (shouldDelete) {
        updateQuantity(bookId, operation);
      }
      return;
    }

    Alert.alert(
      'Remove book?',
      `Are you sure you want to delete "${targetItem.title}" from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => updateQuantity(bookId, operation),
        },
      ],
    );
  };

  const handleClearCart = () => {
    const clearAction = async () => {
      try {
        await cartService.clearCart();
        await loadCart();
      } catch (error) {
        console.warn('Failed to clear cart', error);
        Alert.alert('Error', 'Could not clear cart. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      const shouldClear = typeof globalThis !== 'undefined'
        ? (globalThis as any).confirm?.('This will remove all books from your cart. Continue?')
        : false;

      if (shouldClear) {
        clearAction();
      }
      return;
    }

    Alert.alert('Clear cart?', 'This will remove all books from your cart.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: clearAction,
      },
    ]);
  };

  const executeOrderAll = async () => {
    if (!activeProfileId) {
      Alert.alert('Profile required', 'Please select a profile before placing orders.');
      return;
    }

    if (!cart?.library_id || !items.length) {
      Alert.alert('Cart empty', 'There are no items to order.');
      return;
    }

    setOrderingAll(true);
    let successCount = 0;
    const failedTitles: string[] = [];

    try {
      for (const item of items) {
        for (let index = 0; index < item.quantity; index += 1) {
          try {
            await bookService.issueBook(item.book_id, cart.library_id, activeProfileId);
            successCount += 1;
          } catch {
            failedTitles.push(item.title);
          }
        }
      }

      if (failedTitles.length === 0) {
        await cartService.clearCart();
        await loadCart();
        Alert.alert('Order placed', `Successfully placed ${successCount} order${successCount === 1 ? '' : 's'}.`);
        router.push('/(user)/my-books');
        return;
      }

      await loadCart(false);
      const uniqueFailed = [...new Set(failedTitles)];
      Alert.alert(
        'Partial order placed',
        `Placed ${successCount} order${successCount === 1 ? '' : 's'}. Could not place: ${uniqueFailed.join(', ')}.`,
      );
    } catch (error) {
      console.warn('Failed to place all orders', error);
      Alert.alert('Error', 'Could not place cart order. Please try again.');
    } finally {
      setOrderingAll(false);
    }
  };

  const handleOrderAll = () => {
    const confirmationText = `Order all ${totalCount} book${totalCount === 1 ? '' : 's'} from ${cartLibraryName || 'this library'}?`;

    if (Platform.OS === 'web') {
      const shouldOrder = typeof globalThis !== 'undefined'
        ? (globalThis as any).confirm?.(confirmationText)
        : false;

      if (shouldOrder) {
        executeOrderAll();
      }
      return;
    }

    Alert.alert('Order all items?', confirmationText, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Order All', onPress: executeOrderAll },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentSage} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="cart" />}
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Total Books</Text>
          <Text style={s.summaryValue}>{totalCount}</Text>
          <Text style={s.summaryMeta}>
            {cart?.library_id
              ? `Library: ${cartLibraryName || cart.library_id}`
              : 'No library selected'}
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Your cart is empty</Text>
            <Text style={s.emptyText}>Add books from a library to see them here.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {items.map((item) => (
              <View key={item.book_id} style={s.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{item.title}</Text>
                  <Text style={s.itemAuthor}>{item.author}</Text>
                  <TouchableOpacity
                    style={s.orderItemBtn}
                    onPress={() => router.push(`/(user)/order/${item.book_id}`)}
                  >
                    <Text style={s.orderItemBtnText}>📦 Order this book</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.qtyControlRow}>
                  <TouchableOpacity
                    style={s.qtyActionBtn}
                    disabled={updatingBookId === item.book_id}
                    onPress={() => handleChangeQuantity(item.book_id, 'decrement')}
                  >
                    <Text style={s.qtyActionText}>−</Text>
                  </TouchableOpacity>

                  <View style={s.qtyPill}>
                    <Text style={s.qtyText}>x{item.quantity}</Text>
                  </View>

                  <TouchableOpacity
                    style={s.qtyActionBtn}
                    disabled={updatingBookId === item.book_id}
                    onPress={() => handleChangeQuantity(item.book_id, 'increment')}
                  >
                    <Text style={s.qtyActionText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {items.length > 0 && (
          <TouchableOpacity
            style={s.orderAllBtn}
            disabled={orderingAll || !!updatingBookId}
            onPress={handleOrderAll}
          >
            <Text style={s.orderAllBtnText}>{orderingAll ? 'Placing order...' : '📦 Order All Items'}</Text>
          </TouchableOpacity>
        )}

        {items.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={handleClearCart}>
            <Text style={s.clearBtnText}>Clear Cart</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="cart" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: Colors.accentSage, fontWeight: '700', fontSize: 20 },
  title: { fontSize: Typography.title + 2, color: Colors.textPrimary, fontWeight: '800' },

  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: 6,
    marginBottom: Spacing.md,
  },
  summaryLabel: { fontSize: Typography.label, color: Colors.textSecondary, fontWeight: '700' },
  summaryValue: { fontSize: Typography.title, color: Colors.accentSage, fontWeight: '800' },
  summaryMeta: { fontSize: Typography.label, color: Colors.textMuted },

  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    gap: 6,
  },
  emptyTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: Typography.label, color: Colors.textSecondary },

  list: { gap: Spacing.sm },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemTitle: { fontSize: Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  itemAuthor: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },
  orderItemBtn: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.buttonPrimary,
  },
  orderItemBtnText: {
    color: Colors.buttonPrimaryText,
    fontWeight: '800',
    fontSize: Typography.label,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyActionBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  qtyActionText: {
    fontSize: Typography.body + 2,
    fontWeight: '800',
    color: Colors.accentSage,
    lineHeight: 22,
  },
  qtyPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.accentSageLight,
  },
  qtyText: { color: Colors.accentSage, fontWeight: '800', fontSize: Typography.label },

  clearBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    alignItems: 'center',
    paddingVertical: 14,
  },
  clearBtnText: { color: Colors.buttonPrimaryText, fontWeight: '800', fontSize: Typography.body },

  orderAllBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.full,
    alignItems: 'center',
    paddingVertical: 14,
  },
  orderAllBtnText: { color: Colors.textOnDark, fontWeight: '800', fontSize: Typography.body },
});
