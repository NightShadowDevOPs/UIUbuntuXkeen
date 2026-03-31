/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import VirtualScroller from '@/components/common/VirtualScroller.vue';
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue';
import ProxyName from '@/components/proxies/ProxyName.vue';
import { fromNow } from '@/helper/utils';
import { getRuleHitCount, ruleProviderList } from '@/store/rules';
import { computed, ref } from 'vue';
const props = defineProps();
const rowSize = 44;
const virtualThreshold = 240;
const vsRef = ref(null);
const __VLS_exposed = {
    scrollToIndex: (idx, align) => {
        try {
            vsRef.value?.scrollToIndex?.(idx, align);
        }
        catch {
            // ignore
        }
    },
};
defineExpose(__VLS_exposed);
const rules = computed(() => props.rules || []);
const hitsOf = (r) => getRuleHitCount(r.type, r.payload);
const sizeOf = (r) => {
    if (r.type === 'RuleSet') {
        const v = ruleProviderList.value.find((provider) => provider.name === r.payload)?.ruleCount;
        return typeof v === 'number' ? v : '—';
    }
    return typeof r.size === 'number' ? r.size : '—';
};
const updatedOf = (r) => {
    if (r.type !== 'RuleSet')
        return '';
    const provider = ruleProviderList.value.find((x) => x.name === r.payload);
    if (!provider?.updatedAt)
        return '';
    return fromNow(provider.updatedAt);
};
const topologyValue = (r) => {
    const type = String(r.type || '').trim();
    const payload = String(r.payload || '').trim();
    return payload ? `${type}: ${payload}` : type;
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "overflow-x-auto" },
});
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-[860px]" },
});
/** @type {__VLS_StyleScopedClasses['min-w-[860px]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-base-300 bg-base-100 px-2 py-2 text-xs font-medium opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-1" },
});
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
(__VLS_ctx.$t('type'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-4" },
});
/** @type {__VLS_StyleScopedClasses['col-span-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
(__VLS_ctx.$t('proxy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-1" },
});
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
(__VLS_ctx.$t('hits'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-1" },
});
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
(__VLS_ctx.$t('size'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "col-span-1 text-right" },
});
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
if (__VLS_ctx.rules.length < __VLS_ctx.virtualThreshold) {
    for (const [rule, idx] of __VLS_vFor((__VLS_ctx.rules))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`${rule.type}\u0000${rule.payload}\u0000${idx}`),
            ...{ class: "grid grid-cols-12 items-center gap-2 border-b border-base-200 px-2 py-2 text-sm hover:bg-base-200" },
            'data-nav-kind': "rule",
            'data-rule-type': (rule.type),
            'data-rule-payload': (String(rule.payload || '')),
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (idx + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-2 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-sm font-medium whitespace-nowrap" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        (rule.type);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-4 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        if (rule.payload) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "truncate font-mono text-xs" },
                title: (String(rule.payload)),
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (rule.payload);
            if (__VLS_ctx.updatedOf(rule)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-0.5 text-xs text-base-content/60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
                (__VLS_ctx.$t('updated'));
                (__VLS_ctx.updatedOf(rule));
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-base-content/50 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-2 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        const __VLS_0 = ProxyName;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            name: (rule.proxy),
            ...{ class: "badge badge-sm gap-0" },
        }));
        const __VLS_2 = __VLS_1({
            name: (rule.proxy),
            ...{ class: "badge badge-sm gap-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 whitespace-nowrap text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.hitsOf(rule));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 whitespace-nowrap text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.sizeOf(rule));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 flex justify-end" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        const __VLS_5 = TopologyActionButtons;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            stage: ('R'),
            value: (__VLS_ctx.topologyValue(rule)),
            grouped: (true),
        }));
        const __VLS_7 = __VLS_6({
            stage: ('R'),
            value: (__VLS_ctx.topologyValue(rule)),
            grouped: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        // @ts-ignore
        [$t, $t, $t, $t, $t, rules, rules, virtualThreshold, updatedOf, updatedOf, hitsOf, sizeOf, topologyValue,];
    }
}
else {
    const __VLS_10 = VirtualScroller || VirtualScroller;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ref: "vsRef",
        data: (__VLS_ctx.rules),
        size: (__VLS_ctx.rowSize),
    }));
    const __VLS_12 = __VLS_11({
        ref: "vsRef",
        data: (__VLS_ctx.rules),
        size: (__VLS_ctx.rowSize),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    var __VLS_15 = {};
    const { default: __VLS_17 } = __VLS_13.slots;
    {
        const { default: __VLS_18 } = __VLS_13.slots;
        const [{ item: rule, index }] = __VLS_vSlot(__VLS_18, (_) => []);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-12 items-center gap-2 border-b border-base-200 px-2 py-2 text-sm hover:bg-base-200" },
            'data-nav-kind': "rule",
            'data-rule-type': (rule.type),
            'data-rule-payload': (String(rule.payload || '')),
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (index + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-2 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-sm font-medium whitespace-nowrap" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        (rule.type);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-4 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        if (rule.payload) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "truncate font-mono text-xs" },
                title: (String(rule.payload)),
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (rule.payload);
            if (__VLS_ctx.updatedOf(rule)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-0.5 text-xs text-base-content/60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
                (__VLS_ctx.$t('updated'));
                (__VLS_ctx.updatedOf(rule));
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-base-content/50 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-2 min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        const __VLS_19 = ProxyName;
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
            name: (rule.proxy),
            ...{ class: "badge badge-sm gap-0" },
        }));
        const __VLS_21 = __VLS_20({
            name: (rule.proxy),
            ...{ class: "badge badge-sm gap-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 whitespace-nowrap text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.hitsOf(rule));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 whitespace-nowrap text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.sizeOf(rule));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "col-span-1 flex justify-end" },
        });
        /** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        const __VLS_24 = TopologyActionButtons;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
            stage: ('R'),
            value: (__VLS_ctx.topologyValue(rule)),
            grouped: (true),
        }));
        const __VLS_26 = __VLS_25({
            stage: ('R'),
            value: (__VLS_ctx.topologyValue(rule)),
            grouped: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        // @ts-ignore
        [$t, rules, updatedOf, updatedOf, hitsOf, sizeOf, topologyValue, rowSize,];
        __VLS_13.slots['' /* empty slot name completion */];
    }
    // @ts-ignore
    [];
    var __VLS_13;
}
// @ts-ignore
var __VLS_16 = __VLS_15;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __typeProps: {},
});
export default {};
