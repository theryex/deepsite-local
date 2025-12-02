// lib/get-providers.ts

export const getProviders = async (model: string) => {
  // 🛠️ CHECK FOR LOCAL MODELS FIRST
  // If the model string doesn't look like a standard HF model (e.g., no slash, or specific local patterns),
  // skip the fetch.
  // vLLM models might look like "meta-llama/Llama-2...", so we can't rely solely on that.
  // However, we can wrap the fetch in a try/catch and handle 404s gracefully.

  try {
      const response = await fetch(`https://router.huggingface.co/v1/models/${model}`);

      if (!response.ok) {
          // If 404 or other error, assume it might be local or just invalid.
          // For local models, we don't need external providers.
          console.warn(`[getProviders] Could not fetch providers for ${model} (${response.status}). Assuming local/custom.`);
          return [];
      }

      const json = await response.json();
      const data = json.data || json;
      // Safely access data
      const data = json.data || json; // Handle potential API variations

      if (!data || !data.providers) {
          return [];
      }

      return data.providers.map((provider: any) => provider.provider);
  } catch (error) {
      console.warn(`[getProviders] Failed to fetch providers for ${model}, assuming local or offline.`, error);
      return [];
  }
}
