import { SYSTEM_PROMPT as DEFAULT } from './tools';

let activePrompt = DEFAULT;
export const getSystemPrompt = () => activePrompt;
export const setSystemPrompt = (p: string) => { activePrompt = p; };
export const resetSystemPrompt = () => { activePrompt = DEFAULT; };
export const DEFAULT_SYSTEM_PROMPT = DEFAULT;
