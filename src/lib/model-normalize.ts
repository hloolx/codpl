/**
 * 模型显示名归一化：把各家平台返回的不同 ID 映射为通用展示名。
 * 与旧前端 [frontend/src/App.jsx:355-415] 保持 1:1。
 */
export function normalizeModelDisplay(model = '', modelDisplay = ''): string {
  const combined = `${model} ${modelDisplay}`.toLowerCase();

  if (combined.includes('astron-code-latest')) return 'glm-5';
  if (combined.includes('cm-code-latest')) return 'minimax-m2.5';
  if (combined.includes('deepseek-v4-pro') || combined.includes('deepseek v4 pro')) return 'deepseek-v4-pro';
  if (combined.includes('deepseek-v4-flash') || combined.includes('deepseek v4 flash')) return 'deepseek-v4-flash';
  if (combined.includes('deepseek-v3.2-thinking')) return 'deepseek-v3.2-thinking';
  if (combined.includes('deepseek-v3.2')) return 'deepseek-v3.2';
  if (combined.includes('qwen3.6-plus') || combined.includes('qwen3-6-plus')) return 'qwen3.6-plus';
  if (combined.includes('mimo-v2-omni')) return 'MiMo-V2-Omni';
  if (combined.includes('mimo-v2-pro')) return 'MiMo-V2-Pro';
  if (
    combined.includes('kimi-k2.6')
    || combined.includes('kimi-2.6')
    || combined.includes('kimi 2.6')
    || combined.includes('moonshotai/kimi-k2.6')
    || combined.includes('moonshot/kimi-k2.6')
  ) {
    return 'kimi-k2.6';
  }
  if (
    combined.includes('kimi-k2.5')
    || combined.includes('kimi-2.5')
    || combined.includes('kimi-for-coding')
    || combined.includes('moonshot/kimi-k2.5')
  ) {
    return 'kimi-k2.5';
  }
  if (combined.includes('minimax-m2.7') || combined.includes('m2.7-highspeed')) return 'minimax-m2.7';
  if (combined.includes('minimax-m2.1')) return 'minimax-m2.1';
  if (combined.includes('minimax-m2.5') || combined.includes('m2.5-highspeed')) return 'MiniMax-M2.5';
  if (combined.includes('glm-5.1')) return 'glm-5.1';
  if (combined.includes('glm-5-turbo')) return 'GLM-5-Turbo';
  if (combined.includes('glm-4.7')) return 'glm-4.7';
  if (combined.includes('glm-5') || combined.includes('zai-org/glm-5')) return 'glm-5';

  return modelDisplay || model;
}

export function normalizeLookupKey(value: string | undefined | null = ''): string {
  return `${value ?? ''}`.trim().toLowerCase();
}
