import tippy from 'tippy.js';
let appContent;
let tippyInstance = null;
let currentTarget = null;
export const useTooltip = () => {
    if (!appContent) {
        appContent = document.getElementById('app-content');
    }
    const showTip = (event, content, config = {}) => {
        if (currentTarget === event.currentTarget) {
            return;
        }
        tippyInstance?.destroy();
        tippyInstance = tippy(event.currentTarget, {
            content,
            placement: 'top',
            animation: 'scale',
            appendTo: appContent,
            allowHTML: true,
            showOnCreate: true,
            onHidden: () => {
                tippyInstance?.destroy();
                tippyInstance = null;
                currentTarget = null;
            },
            popperOptions: {
                modifiers: [
                    {
                        name: 'preventOverflow',
                        options: {
                            boundary: 'clippingParents',
                            padding: 8,
                        },
                    },
                    {
                        name: 'flip',
                        options: {
                            fallbackPlacements: ['top', 'bottom', 'right', 'left'],
                        },
                    },
                ],
            },
            ...config,
        });
        currentTarget = event.currentTarget;
    };
    const hideTip = () => {
        tippyInstance?.hide();
    };
    return {
        showTip,
        hideTip,
    };
};
const { showTip } = useTooltip();
export const checkTruncation = (e) => {
    const target = e.target;
    const { scrollWidth, clientWidth } = target;
    if (scrollWidth > clientWidth) {
        showTip(e, target.innerText, {
            delay: [700, 0],
            trigger: 'mouseenter',
            touch: ['hold', 500],
        });
    }
};
