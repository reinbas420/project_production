import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export type NavRole = 'user' | 'child';
export type UserTab = 'home' | 'mybooks' | 'cart' | 'owl' | 'profile' | 'switch';
export type ChildTab = 'home' | 'owl';

type UserProps = { role: 'user'; active: UserTab };
type ChildProps = { role: 'child'; active: ChildTab };
type Props = UserProps | ChildProps;

const USER_ITEMS: { id: UserTab; label: string; icon: string; route: string }[] = [
  { id: 'home',    label: 'Home',      icon: 'home',       route: '/(user)'            },
  { id: 'mybooks', label: 'My Orders', icon: 'receipt-long', route: '/(user)/my-books'  },
  { id: 'cart',    label: 'Cart',      icon: 'shopping-cart', route: '/(user)/cart'      },
  { id: 'owl',     label: 'Owl AI',    icon: 'smart-toy',  route: '/(user)/owl'        },
  { id: 'profile', label: 'Profile',   icon: 'person',     route: '/(user)/edit-profile'},
  { id: 'switch',  label: 'Profiles',  icon: 'swap-horiz', route: '/(select-profile)'  },
];

const CHILD_ITEMS: { id: ChildTab; label: string; icon: string; route: string }[] = [
  { id: 'home', label: 'Home', icon: 'home', route: '/(child)' },
  { id: 'owl',  label: 'Owl',  icon: 'smart-toy', route: '/(child)/owl' },
];

export function NavBar(props: Props) {
  const router = useRouter();
  const items = props.role === 'user' ? USER_ITEMS : CHILD_ITEMS;
  const active = props.active;

  if (Platform.OS === 'web') {
    return (
      <View style={sw.bar}>
        {items.map(item => {
          const isActive = item.id === active;
          return (
            <TouchableOpacity
              key={item.id}
              style={[sw.item, isActive && sw.itemActive]}
              onPress={() => router.navigate(item.route as any)}
              activeOpacity={0.75}
            >
              <MaterialIcons
                name={item.icon as any}
                size={17}
                color={isActive ? Colors.accentSage : Colors.textMuted}
              />
              <Text style={[sw.label, isActive && sw.labelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Mobile — bottom bar
  return (
    <View style={sb.bar}>
      {items.map(item => {
        const isActive = item.id === active;
        return (
          <TouchableOpacity
            key={item.id}
            style={sb.item}
            onPress={() => router.navigate(item.route as any)}
            activeOpacity={0.75}
          >
            <View style={[sb.iconWrap, isActive && sb.iconWrapActive]}>
              <MaterialIcons
                name={item.icon as any}
                size={22}
                color={isActive ? Colors.accentSage : Colors.textMuted}
              />
            </View>
            <Text style={[sb.label, isActive && sb.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** How many pixels of padding to add to the bottom of ScrollView content on mobile */
export const NAV_BOTTOM_PAD = Platform.OS === 'web' ? 0 : 72;

const sb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingBottom: 8,
    paddingTop: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Colors.accentSageLight,
  },
  label: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  labelActive: { color: Colors.accentSage, fontWeight: '700' },
});

const sw = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  itemActive: {
    backgroundColor: Colors.accentSageLight,
  },
  label: { fontSize: Typography.label, fontWeight: '600', color: Colors.textMuted },
  labelActive: { color: Colors.accentSage, fontWeight: '700' },
});
