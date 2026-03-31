declare var __VLS_1: {
    open: any;
}, __VLS_3: {
    open: any;
}, __VLS_5: {
    showFullContent: any;
};
type __VLS_Slots = {} & {
    title?: (props: typeof __VLS_1) => any;
} & {
    preview?: (props: typeof __VLS_3) => any;
} & {
    content?: (props: typeof __VLS_5) => any;
};
declare const __VLS_base: any;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
