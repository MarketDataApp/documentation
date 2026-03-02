import { setThemeCookie } from '@marketdataapp/ui/theme';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

if (ExecutionEnvironment.canUseDOM) {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName === 'data-theme') {
                const theme = document.documentElement.getAttribute('data-theme');
                if (theme === 'dark' || theme === 'light') {
                    setThemeCookie(theme);
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
}
