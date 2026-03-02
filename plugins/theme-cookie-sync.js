module.exports = function themeCookieSyncPlugin() {
    return {
        name: 'theme-cookie-sync',
        injectHtmlTags() {
            return {
                headTags: [
                    {
                        tagName: 'script',
                        innerHTML: `(function(){var m=document.cookie.match(/(?:^|;\\s*)theme=(dark|light)/);if(m)try{localStorage.setItem('theme',m[1])}catch(e){}})();`,
                    },
                ],
            };
        },
    };
};
