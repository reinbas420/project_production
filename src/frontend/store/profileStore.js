import { create } from 'zustand';

/**
 * Profile Store
 * Manages user profiles (Child / Parent) and the active profile selection.
 * Supports profile switching and Parenting Mode toggle (PIN-protected).
 */
const useProfileStore = create((set, get) => ({
    // ── State ──────────────────────────────────────────
    activeProfile: null,
    profiles: [],
    isParentMode: false,

    // ── Actions ────────────────────────────────────────

    /**
     * Populate profile list (usually from API response after login).
     */
    setProfiles: (profiles) => set({ profiles }),

    /**
     * Select a profile as the active one (e.g., after login or from profile picker).
     * Automatically sets isParentMode based on the selected profile's accountType.
     */
    selectProfile: (profileId) => {
        const { profiles } = get();
        const profile = profiles.find((p) => p.profileId === profileId);
        if (profile) {
            set({
                activeProfile: profile,
                isParentMode: profile.accountType === 'PARENT',
            });
        }
    },

    /**
     * Switch from the current profile to another.
     */
    switchProfile: (profileId) => {
        get().selectProfile(profileId);
    },

    /**
     * Toggle Parenting Mode on/off. The PIN verification should happen
     * in the UI layer before calling this action.
     */
    toggleParentMode: () =>
        set((state) => ({ isParentMode: !state.isParentMode })),

    /**
     * Clear all profile state (e.g., on logout).
     */
    clearProfiles: () =>
        set({ activeProfile: null, profiles: [], isParentMode: false }),
}));

export default useProfileStore;
