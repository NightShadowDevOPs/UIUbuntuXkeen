import { type Props } from 'tippy.js';
export declare const useTooltip: () => {
    showTip: (event: Event, content: string | HTMLElement, config?: Partial<Props>) => void;
    hideTip: () => void;
};
export declare const checkTruncation: (e: Event) => void;
