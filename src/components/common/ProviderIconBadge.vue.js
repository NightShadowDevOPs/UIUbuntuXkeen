import { countryCodeToEmoji, normalizeCountryCode } from '@/helper/flagIcons';
import { normalizeProviderIcon } from '@/helper/providerIcon';
import { GlobeAltIcon } from '@heroicons/vue/24/outline';
import { computed } from 'vue';

const props = withDefaults(defineProps(), { size: 'md' });
const raw = computed(() => normalizeProviderIcon(props.icon));
const kind = computed(() => {
  if (!raw.value) return 'none';
  if (raw.value === 'globe') return 'globe';
  return 'flag';
});
const flagCode = computed(() => {
  if (kind.value !== 'flag') return '';
  return normalizeCountryCode(raw.value);
});
const flagEmoji = computed(() => countryCodeToEmoji(flagCode.value));
const titleText = computed(() => {
  if (kind.value === 'none') return '—';
  if (kind.value === 'globe') return 'globe';
  return flagCode.value || raw.value;
});
const emojiClass = computed(() =>
  props.size === 'sm'
    ? 'text-[14px] leading-none font-["Twemoji","NotoEmoji",system-ui,sans-serif]'
    : 'text-[16px] leading-none font-["Twemoji","NotoEmoji",system-ui,sans-serif]'
);

export { GlobeAltIcon, props, raw, kind, flagCode, flagEmoji, titleText, emojiClass };
export default {};
