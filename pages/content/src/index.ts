import { addRuntimeEventListeners, addWindowEventListeners } from './event-listeners';
import { injectExtendScript } from './injected-scripts';

injectExtendScript();

addWindowEventListeners();

addRuntimeEventListeners();
