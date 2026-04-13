'use client'

import { handleVideoGeneration_fal } from '@/utils/handleGeneration/handleFalVideo';
import { handleImageGeneration_fal } from '@/utils/handleGeneration/handleFal';
import { handleMidjourneyGeneration } from '@/server-action/ai-generation/midjourneyGen_client';
import { handleSeedreamGeneration } from '@/server-action/ai-generation/seedreamGen_client';
import { handleBltcyGeneration } from '@/server-action/ai-generation/falGen_client';
import { findSettingByModelId } from "@/lib/ai-model-setting/modelSetting";
import { urlToBase64 } from '@/utils/tools/fileUrlProcess';

export interface OnSubmitClientParams {
    userInputData: any;
    setIsGenerating: (value: any, meta?: any) => void | null;
    setGenerationStatus?: React.Dispatch<React.SetStateAction<string>> | null;
    setGenerationSrc: any;
    setRecentGenerations?: any;
    handleCallBack?: (data: any) => void;
    options?: {
        [key: string]: any;
    }
}

export const handleGeneration_switch = async (
    handle_input: OnSubmitClientParams
) => {
    await handleGeneration_switch_model(handle_input)
}

export const handleGeneration_switch_model = async (
    handle_input: OnSubmitClientParams
) => {
    let prediction_object: any

    const { userInputData, setGenerationStatus, setIsGenerating, options } = handle_input

    try {
        if (options?.isClient && !options?.customApiKey) {
            throw new Error("No custom api key provided");
        }

        const gen_model_id = userInputData.model_id?.toLowerCase() || '';

        // model support check
        const setting = findSettingByModelId(gen_model_id);
        const apiEndpoint = setting?.apiInput?.endpoint;

        const gen_type = setting?.type?.toLowerCase() || '';
        const gen_model_provider = setting?.apiInput?.provider.toLowerCase() || ''
        if (!apiEndpoint && gen_model_provider == "fal") {
            throw new Error("Unsupported model, no endpoint");
        };

        if (!gen_type || !gen_model_provider) {
            throw new Error("Unsupported model, no type or provider");
        }

        switch (gen_model_provider) {
            case "fal":
                prediction_object = gen_type === "image" ?
                    await handleImageGeneration_fal(handle_input) :
                    await handleVideoGeneration_fal(handle_input)
                break;

            case "midjourney": {
                const mjApiKey = options?.mjApiKey || '';
                const mjBaseUrl = options?.mjBaseUrl || 'https://api.midjourney.com';
                if (!mjApiKey) throw new Error("Midjourney API key not set");
                prediction_object = await wrapCustomGeneration({
                    ...handle_input,
                    options: { ...options, customApiKey: mjApiKey, baseUrl: mjBaseUrl, provider: 'midjourney' }
                }, handleMidjourneyGeneration);
                break;
            }

            case "seedream": {
                const seedApiKey = options?.seedApiKey || '';
                const seedBaseUrl = options?.seedBaseUrl || 'https://api.seedream.vip';
                if (!seedApiKey) throw new Error("Seedream API key not set");
                prediction_object = await wrapCustomGeneration({
                    ...handle_input,
                    options: { ...options, customApiKey: seedApiKey, baseUrl: seedBaseUrl, provider: 'seedream' }
                }, handleSeedreamGeneration);
                break;
            }

            case "bltcy": {
                const bltcyApiKey = options?.bltcyApiKey || '';
                if (!bltcyApiKey) throw new Error("bltcy API key not set");
                prediction_object = await wrapCustomGeneration({
                    ...handle_input,
                    options: { ...options, customApiKey: bltcyApiKey, baseUrl: 'https://api.bltcy.ai', provider: 'bltcy' }
                }, handleBltcyGeneration);
                break;
            }

            // add other model provider here replicate , huggingface , kling , runway , openai , etc

            default:
                throw new Error(`Unsupported model provider for: ${gen_model_provider}`);
        }

    } catch (error: any) {
        setGenerationStatus && setGenerationStatus(error.message || "Unexpected error occurred");
        setIsGenerating && setIsGenerating(false);

    }

}

// =============================================================================
// Generic wrapper for custom API providers
// Converts OnSubmitClientParams → provider-specific handler call
// =============================================================================

type CustomGenHandler = (
    baseUrl: string,
    apiKey: string,
    model_id: string,
    data: any,
    onProgress?: (p: string) => void
) => Promise<{ success: boolean; data: any; error: string | null }>;

async function wrapCustomGeneration(
    handle_input: OnSubmitClientParams,
    handler: CustomGenHandler
) {
    const { userInputData, setGenerationStatus, setIsGenerating, setGenerationSrc, handleCallBack, options } = handle_input;

    const { customApiKey, baseUrl, provider, ...restOptions } = options || {};
    const model_id = userInputData.model_id;
    const data = { ...userInputData };

    setIsGenerating && setIsGenerating('update');
    setGenerationStatus && setGenerationStatus(`${provider} generating...`);

    const result = await handler(baseUrl, customApiKey, model_id, data, (progress) => {
        setGenerationStatus && setGenerationStatus(`${provider} progress: ${progress}`);
    });

    if (!result.success) {
        throw new Error(result.error || 'Generation failed');
    }

    let generated: Array<{ url: string }> = [];

    if (provider === 'midjourney' && result.data?.imageUrl) {
        // Midjourney returns { imageUrl, buttons, ... }
        generated = [{ url: result.data.imageUrl }];
    } else if (provider === 'seedream' && result.data) {
        // Seedream returns direct image URL string or object
        const url = typeof result.data === 'string' ? result.data : result.data?.imageUrl;
        if (url) generated = [{ url }];
    } else if (provider === 'bltcy' && result.data?.images) {
        // bltcy OpenAI-compatible returns { images: [{url}] }
        generated = result.data.images;
    } else if (result.data?.images) {
        generated = result.data.images;
    } else if (result.data?.url) {
        generated = [{ url: result.data.url }];
    }

    if (!generated.length) {
        throw new Error("No images in generation result");
    }

    const dataMeta = {
        prompt: userInputData.prompt || userInputData.prompt_process,
        model_id,
        model: findSettingByModelId(model_id)?.label || model_id,
        aspect_ratio: userInputData.aspect_ratio,
        created_at: new Date().toISOString(),
    };

    if (handleCallBack) {
        handleCallBack({ type: 'image', generationResult: generated });
    }

    if (setGenerationSrc) {
        let displayImageObjects = generated.map((image: any) => ({
            ...image,
            generationUrl: image?.url,
            input: dataMeta,
            type: 'image',
        }));

        const displayImages = await Promise.all(
            displayImageObjects.map(async (imageObj: any) => {
                try {
                    const base64 = await urlToBase64(imageObj.generationUrl);
                    if (base64?.startsWith('data:')) return { ...imageObj, generationUrl: base64 };
                    return imageObj;
                } catch {
                    return imageObj;
                }
            })
        );

        setGenerationSrc({ data: displayImages, isTmp: true, type: 'images' });
    }

    setIsGenerating && setIsGenerating(false);
    setGenerationStatus && setGenerationStatus('Done');
    return { success: true };
}
