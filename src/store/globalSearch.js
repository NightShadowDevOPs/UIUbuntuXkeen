import { ref } from 'vue';
/**
 * Global search (command palette) modal open state.
 * Kept in a store so it can be opened from Sidebar, keyboard shortcut, etc.
 */
export const globalSearchOpen = ref(false);
