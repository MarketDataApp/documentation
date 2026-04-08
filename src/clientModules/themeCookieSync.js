import { syncThemeCookie } from '@marketdataapp/ui/theme';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

if (ExecutionEnvironment.canUseDOM) {
    syncThemeCookie();
}
