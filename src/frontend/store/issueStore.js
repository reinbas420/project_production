import { create } from 'zustand';

/**
 * Issue Store
 * Manages issue lifecycle state: active issues, payments, penalties,
 * and delivery tracking. Maps to Issues, Payments, Penalties, and
 * Deliveries entities in DB V1.
 */
const useIssueStore = create((set) => ({
    // ── State ──────────────────────────────────────────
    issues: [],
    activeIssue: null,
    payments: [],
    penalty: null,
    delivery: null,
    isLoading: false,

    // ── Actions ────────────────────────────────────────

    /** Set the list of issues for the current profile. */
    setIssues: (issues) => set({ issues }),

    /** Select a specific issue to view details. */
    setActiveIssue: (issue) => set({ activeIssue: issue }),

    /** Set payments for the active issue. */
    setPayments: (payments) => set({ payments }),

    /** Set penalty info for the active issue (null if no penalty). */
    setPenalty: (penalty) => set({ penalty }),

    /** Set delivery info for the active issue (null if no delivery). */
    setDelivery: (delivery) => set({ delivery }),

    /** Set loading state for issue-related API calls. */
    setLoading: (isLoading) => set({ isLoading }),

    /** Clear all issue state (e.g., on profile switch or logout). */
    clearIssues: () =>
        set({
            issues: [],
            activeIssue: null,
            payments: [],
            penalty: null,
            delivery: null,
        }),
}));

export default useIssueStore;
