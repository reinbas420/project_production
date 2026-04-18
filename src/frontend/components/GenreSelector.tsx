/**
 * GenreSelector — reusable animated genre-picker component.
 *
 * Features:
 *  - Pill/chip buttons with toggle animation
 *  - Kid-friendly subset with emojis for child profiles
 *  - Min 1 / max 5 selection enforcement
 */
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import React from 'react';
import {
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ── Genre lists ────────────────────────────────────────────────────────────────

interface GenreItem {
    label: string;
    emoji: string;
}

const ADULT_GENRES: GenreItem[] = [
    { label: 'Fiction', emoji: '📖' },
    { label: 'Non-Fiction', emoji: '📚' },
    { label: 'Fantasy', emoji: '🧙' },
    { label: 'Science', emoji: '🔬' },
    { label: 'Mystery', emoji: '🔍' },
    { label: 'Comics', emoji: '🦸' },
    { label: 'Biography', emoji: '🧑‍💼' },
    { label: 'History', emoji: '🏛️' },
    { label: 'Poetry', emoji: '🎭' },
    { label: 'Adventure', emoji: '⛰️' },
    { label: 'Romance', emoji: '💕' },
    { label: 'Horror', emoji: '👻' },
    { label: 'Self-Help', emoji: '🌱' },
    { label: 'Technology', emoji: '💻' },
    { label: 'Cooking', emoji: '🍳' },
    { label: 'Art', emoji: '🎨' },
];

const CHILD_GENRES: GenreItem[] = [
    { label: 'Fantasy', emoji: '🧙' },
    { label: 'Adventure', emoji: '⛰️' },
    { label: 'Science', emoji: '🔬' },
    { label: 'Comics', emoji: '🦸' },
    { label: 'Animals', emoji: '🐾' },
    { label: 'Fairy Tales', emoji: '🧚' },
    { label: 'Mystery', emoji: '🔍' },
    { label: 'Humor', emoji: '😂' },
    { label: 'Space', emoji: '🚀' },
    { label: 'Art', emoji: '🎨' },
    { label: 'Sports', emoji: '⚽' },
    { label: 'History', emoji: '🏛️' },
];

const MAX_GENRES = 5;
const MIN_GENRES = 1;

// ── Animated chip ──────────────────────────────────────────────────────────────

function GenreChip({
    genre,
    selected,
    onPress,
    disabled,
}: {
    genre: GenreItem;
    selected: boolean;
    onPress: () => void;
    disabled: boolean;
}) {
    const scale = React.useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        onPress();
    };

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                style={[
                    st.chip,
                    selected && st.chipSelected,
                    disabled && !selected && st.chipDisabled,
                ]}
                activeOpacity={0.75}
                onPress={handlePress}
                disabled={disabled && !selected}
            >
                <Text style={st.chipEmoji}>{genre.emoji}</Text>
                <Text style={[st.chipLabel, selected && st.chipLabelSelected]}>
                    {genre.label}
                </Text>
                {selected && <Text style={st.chipCheck}>✓</Text>}
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── GenreSelector ──────────────────────────────────────────────────────────────

interface GenreSelectorProps {
    selectedGenres: string[];
    onGenresChange: (genres: string[]) => void;
    isChild?: boolean;
    title?: string;
}

export default function GenreSelector({
    selectedGenres,
    onGenresChange,
    isChild = false,
    title,
}: GenreSelectorProps) {
    const genres = isChild ? CHILD_GENRES : ADULT_GENRES;
    const atMax = selectedGenres.length >= MAX_GENRES;

    const toggle = (label: string) => {
        if (selectedGenres.includes(label)) {
            onGenresChange(selectedGenres.filter((g) => g !== label));
        } else if (!atMax) {
            onGenresChange([...selectedGenres, label]);
        }
    };

    return (
        <View style={st.container}>
            <View style={st.headerRow}>
                <Text style={st.title}>
                    {title || (isChild ? '📚 Pick favourite genres' : '📚 Choose your genres')}
                </Text>
                <Text style={st.counter}>
                    {selectedGenres.length} / {MAX_GENRES}
                </Text>
            </View>
            <Text style={st.hint}>
                Select at least {MIN_GENRES}, up to {MAX_GENRES} genres
            </Text>

            <ScrollView
                contentContainerStyle={st.grid}
                showsVerticalScrollIndicator={false}
            >
                {genres.map((g) => (
                    <GenreChip
                        key={g.label}
                        genre={g}
                        selected={selectedGenres.includes(g.label)}
                        onPress={() => toggle(g.label)}
                        disabled={atMax}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
    container: { gap: Spacing.sm },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: Typography.title - 2,
        fontWeight: '800',
        color: Colors.accentSage,
    },
    counter: {
        fontSize: Typography.label,
        fontWeight: '700',
        color: Colors.textSecondary,
        backgroundColor: Colors.accentSageLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    hint: {
        fontSize: Typography.label,
        color: Colors.textMuted,
        marginBottom: Spacing.xs,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: Radius.full,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.cardBorder,
    },
    chipSelected: {
        backgroundColor: Colors.accentSageLight,
        borderColor: Colors.accentSage,
    },
    chipDisabled: {
        opacity: 0.45,
    },
    chipEmoji: {
        fontSize: 18,
    },
    chipLabel: {
        fontSize: Typography.label + 1,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    chipLabelSelected: {
        color: Colors.accentSage,
        fontWeight: '700',
    },
    chipCheck: {
        fontSize: 14,
        color: Colors.accentSage,
        fontWeight: '800',
    },
});
