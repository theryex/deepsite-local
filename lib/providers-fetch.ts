// lib/get-providers.ts

export const getProviders = async (model: string) => {
  // 🛠️ CHECK FOR LOCAL MODELS FIRST
  // If the model string starts with / (like /mnt/...) or contains local identifiers, skip the fetch.
  if (model.startsWith('/') || model.startsWith('\\') || model.includes('local-') || model.includes('192.168')) {
    console.log(`[getProviders] Skipping HF fetch for local model: ${model}`);
    return [];
  }

  try {
      // Ensure we don't create double slashes if the model name is somehow weird
      const cleanModel = model.replace(/^\/+/, '');

      const response = await fetch(`https://router.huggingface.co/v1/models/${cleanModel}`);

      if (!response.ok) {
          // If 404 or other error, assume it might be local or just invalid.
          // For local models, we don't need external providers.
          return [];
      }

      const json = await response.json();
      // Ensure we access data correctly without redeclaring
      const providersData = json.data || json;

      if (!providersData || !providersData.providers) {
          return [];
      }

      return providersData.providers.map((provider: any) => provider.provider);
  } catch (error) {
      console.warn(`[getProviders] Failed to fetch providers for ${model}, assuming local or offline.`, error);
      return [];
  }
}
