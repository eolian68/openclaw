import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";

const DASHSCOPE_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const PROVIDER_ID = "dashscope-qwen3";
const MODEL_ID = "qwen3-vl-plus";

export type ModelConfigProps = {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  saving: boolean;
  error: string | null;
  success: boolean;
  configured: boolean;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onSave: () => void;
};

export function renderModelConfig(props: ModelConfigProps): TemplateResult {
  const {
    baseUrl,
    apiKey,
    modelId,
    saving,
    error,
    success,
    configured,
    onBaseUrlChange,
    onApiKeyChange,
    onModelIdChange,
    onSave,
  } = props;

  return html`
    <div class="model-config">
      <div class="model-config__header">
        <h2 class="model-config__title">${t("modelConfig.title")}</h2>
        <p class="model-config__subtitle">${t("modelConfig.subtitle")}</p>
      </div>

      <div class="model-config__card">
        <p class="model-config__hint">${t("modelConfig.hint")}</p>

        <div class="model-config__form">
          <div class="field">
            <label for="model-config-baseUrl">${t("modelConfig.baseUrl")}</label>
            <input
              id="model-config-baseUrl"
              type="url"
              placeholder="${DASHSCOPE_DEFAULT_BASE_URL}"
              .value=${baseUrl}
              @input=${(e: Event) => onBaseUrlChange((e.target as HTMLInputElement).value)}
              ?disabled=${saving}
            />
          </div>

          <div class="field">
            <label for="model-config-apiKey">${t("modelConfig.apiKey")}</label>
            <input
              id="model-config-apiKey"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
              .value=${apiKey}
              @input=${(e: Event) => onApiKeyChange((e.target as HTMLInputElement).value)}
              ?disabled=${saving}
            />
          </div>

          <div class="field">
            <label for="model-config-modelId">${t("modelConfig.modelId")}</label>
            <input
              id="model-config-modelId"
              type="text"
              placeholder="${MODEL_ID}"
              .value=${modelId}
              @input=${(e: Event) => onModelIdChange((e.target as HTMLInputElement).value)}
              ?disabled=${saving}
            />
          </div>

          ${error ? html`<p class="model-config__error">${error}</p>` : nothing}

          <div class="model-config__actions">
            <button
              class="btn btn--primary"
              ?disabled=${saving || !baseUrl.trim() || !apiKey.trim() || !modelId.trim()}
              @click=${onSave}
            >
              ${saving ? t("common.saving") : configured ? t("modelConfig.update") : t("modelConfig.save")}
            </button>
          </div>
        </div>

        ${success
          ? html`<p class="model-config__success">${t("modelConfig.saved")}</p>`
          : configured
            ? html`<p class="model-config__success">${t("modelConfig.configured")}</p>`
            : nothing}
      </div>
    </div>
  `;
}
