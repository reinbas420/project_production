/**
 * LanguageSelector — reusable animated language-picker component.
 *
 * Features:
 *  - Pill/chip buttons with toggle animation
 *  - Min 1 / max 3 selection enforcement
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

// ── Language list ──────────────────────────────────────────────────────────────

interface LanguageItem {
    label: string;
    nativeName: string;
}

const LANGUAGES: LanguageItem[] = [
    { label: 'English', nativeName: 'English' },
    { label: 'Hindi', nativeName: 'हिंदी' },
    { label: 'Telugu', nativeName: 'తెలుగు' },
    { label: 'Tamil', nativeName: 'தமிழ்' },
    { label: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { label: 'Malayalam', nativeName: 'മലയാളം' },
    { label: 'Marathi', nativeName: 'मराठी' },
    { label: 'Bengali', nativeName: 'বাংলা' },
    { label: 'Gujarati', nativeName: 'ગુજરાતી' },
    { label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
    { label: 'Urdu', nativeName: 'اردو' },
    { label: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
    { label: 'Assamese', nativeName: 'অসমীয়া' },
    { label: 'Sanskrit', nativeName: 'संस्कृतम्' },
];

const MAX_LANGUAGES = 3;
const MIN_LANGUAGES = 1;

// ── Animated chip ──────────────────────────────────────────────────────────────

function LanguageChip({
    language,
    selected,
    onPress,
    disabled,
}: {
    language: LanguageItem;
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
                <View style={st.labelContainer}>
                    <Text style={[st.chipLabel, selected && st.chipLabelSelected]}>
                        {language.label}
                    </Text>
                    {language.label !== language.nativeName && (
                        <Text style={[st.chipNativeLabel, selected && st.chipNativeLabelSelected]}>
                            {language.nativeName}
                        </Text>
                    )}
                </View>
                {selected && <Text style={st.chipCheck}>✓</Text>}
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── LanguageSelector ───────────────────────────────────────────────────────────

interface LanguageSelectorProps {
    selectedLanguages: string[];
    onLanguagesChange: (languages: string[]) => void;
}

export default function LanguageSelector({
    selectedLanguages,
    onLanguagesChange,
}: LanguageSelectorProps) {
    const atMax = selectedLanguages.length >= MAX_LANGUAGES;

    const toggle = (label: string) => {
        if (selectedLanguages.includes(label)) {
            onLanguagesChange(selectedLanguages.filter((l) => l !== label));
        } else if (!atMax) {
            onLanguagesChange([...selectedLanguages, label]);
        }
    };

    return (
        <View style={st.container}>
            <View style={st.headerRow}>
                <Text style={st.title}>🗣️ Choose languages</Text>
                <Text style={st.counter}>
                    {selectedLanguages.length} / {MAX_LANGUAGES}
                </Text>
            </View>
            <Text style={st.hint}>
                Select up to {MAX_LANGUAGES} languages you prefer to read in
            </Text>

            <ScrollView
                contentContainerStyle={st.grid}
                showsVerticalScrollIndicator={false}
            >
                {LANGUAGES.map((l) => (
                    <LanguageChip
                        key={l.label}
                        language={l}
                        selected={selectedLanguages.includes(l.label)}
                        onPress={() => toggle(l.label)}
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
        gap: 8,
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
    labelContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
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
    chipNativeLabel: {
        fontSize: 10,
        color: Colors.textMuted,
        marginTop: 1,
    },
    chipNativeLabelSelected: {
        color: Colors.accentSage,
        opacity: 0.8,
    },
    chipCheck: {
        fontSize: 14,
        color: Colors.accentSage,
        fontWeight: '800',
    },
});
