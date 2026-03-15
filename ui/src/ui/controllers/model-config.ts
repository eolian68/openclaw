import type { GatewayBrowserClient } from "../gateway.ts";

export type ModelConfigState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  saving: boolean;
  error: string | null;
  success: boolean;
};

const PROVIDER_ID = "dashscope-qwen3";
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL_ID = "qwen3-vl-plus";

export function getInitialModelConfigState(): Partial<ModelConfigState> {
  return {
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
    modelId: DEFAULT_MODEL_ID,
    saving: false,
    error: null,
    success: false,
  };
}

/**
 * Load existing model config from config snapshot to prefill the form.
 * Extracts baseUrl, modelId from models.providers.dashscope-qwen3 if present.
 */
export function applyModelConfigFromSnapshot(
  state: ModelConfigState,
  config: Record<string, unknown> | null,
): void {
  if (!config) return;
  const models = config.models as Record<string, unknown> | undefined;
  const providers = models?.providers as Record<string, unknown> | undefined;
  const provider = providers?.[PROVIDER_ID] as Record<string, unknown> | undefined;
  if (provider) {
    if (typeof provider.baseUrl === "string" && provider.baseUrl) {
      state.baseUrl = provider.baseUrl;
    }
    const modelsList = provider.models as Array<{ id?: string }> | undefined;
    const firstModel = modelsList?.[0];
    if (firstModel?.id) {
      state.modelId = firstModel.id;
    }
  }
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelCfg = defaults?.model as Record<string, unknown> | undefined;
  const primary = modelCfg?.primary as string | undefined;
  if (typeof primary === "string" && primary.startsWith(`${PROVIDER_ID}/`)) {
    const modelPart = primary.slice(`${PROVIDER_ID}/`.length);
    if (modelPart) state.modelId = modelPart;
  }
}

export type ModelConfigHost = {
  modelConfigBaseUrl: string;
  modelConfigApiKey: string;
  modelConfigModelId: string;
  modelConfigSaving: boolean;
  modelConfigError: string | null;
  modelConfigSuccess: boolean;
  client: GatewayBrowserClient | null;
  connected: boolean;
};

/**
 * Prefill model config form from existing config when host uses modelConfigBaseUrl etc.
 */
export function applyModelConfigFromSnapshotToHost(
  host: ModelConfigHost,
  config: Record<string, unknown> | null,
): void {
  const state: ModelConfigState = {
    baseUrl: host.modelConfigBaseUrl,
    apiKey: host.modelConfigApiKey,
    modelId: host.modelConfigModelId,
    saving: host.modelConfigSaving,
    error: host.modelConfigError,
    success: host.modelConfigSuccess,
    client: host.client,
    connected: host.connected,
  };
  applyModelConfigFromSnapshot(state, config);
  host.modelConfigBaseUrl = state.baseUrl;
  host.modelConfigApiKey = state.apiKey;
  host.modelConfigModelId = state.modelId;
}

/**
 * Save model config from host with modelConfig* fields; syncs saving/error/success back to host.
 */
export async function saveModelConfigFromHost(host: ModelConfigHost): Promise<void> {
  const state: ModelConfigState = {
    baseUrl: host.modelConfigBaseUrl,
    apiKey: host.modelConfigApiKey,
    modelId: host.modelConfigModelId,
    saving: host.modelConfigSaving,
    error: host.modelConfigError,
    success: host.modelConfigSuccess,
    client: host.client,
    connected: host.connected,
  };
  await saveModelConfig(state);
  host.modelConfigSaving = state.saving;
  host.modelConfigError = state.error;
  host.modelConfigSuccess = state.success;
  host.modelConfigApiKey = state.apiKey;
}

export async function saveModelConfig(state: ModelConfigState): Promise<void> {
  if (!state.client || !state.connected) {
    state.error = "Not connected.";
    return;
  }
  state.saving = true;
  state.error = null;
  state.success = false;
  try {
    const baseUrl = state.baseUrl.trim();
    const apiKey = state.apiKey.trim();
    const modelId = state.modelId.trim();
    if (!baseUrl || !modelId || !apiKey) {
      state.error = "Base URL, API Key, and Model ID are required.";
      state.saving = false;
      return;
    }
    const baseUrlNormalized = /\/v1\/?$/.test(baseUrl)
      ? baseUrl.replace(/\/$/, "")
      : baseUrl.replace(/\/?$/, "") + "/v1";

    await state.client.request("env.patch", {
      vars: {
        DASHSCOPE_API_KEY: apiKey,
        DASHSCOPE_BASE_URL: baseUrlNormalized,
      },
    });

    const configPatch = {
      models: {
        providers: {
          [PROVIDER_ID]: {
            baseUrl: baseUrlNormalized,
            api: "openai-completions",
            apiKey: { source: "env" as const, provider: "default", id: "DASHSCOPE_API_KEY" },
            models: [
              {
                id: modelId,
                name: modelId,
                contextWindow: 128000,
                maxTokens: 8192,
                input: ["text", "image"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              },
            ],
          },
        },
      },
      agents: {
        defaults: {
          model: { primary: `${PROVIDER_ID}/${modelId}` },
        },
      },
    };

    const snapshot = await state.client.request<{ hash?: string }>("config.get", {});
    const baseHash = (snapshot as { hash?: string }).hash;
    if (!baseHash) {
      state.error = "Config hash missing; reload and retry.";
      state.saving = false;
      return;
    }

    const raw = JSON.stringify(configPatch, null, 2);
    await state.client.request("config.patch", { raw, baseHash });
    state.success = true;
    if (apiKey) state.apiKey = "";
  } catch (err) {
    state.error = String(err);
  } finally {
    state.saving = false;
  }
}
