"use client";

import { createFalClient, ValidationError } from "@fal-ai/client";

import type { FalClient } from "@fal-ai/client";

import { buildApiInput } from '@/utils/tools/mapping';

import { findSettingByModelId } from "@/lib/ai-model-setting/modelSetting";

import { ApiError } from '@fal-ai/client';

// fal client version ,use custom key
export const handleFalGeneration_queue = async (data: any, webhook_url = '', customApiKey: string = '') => {
    // let fal_enpoint = 'fal-ai/flux/schnell'

    const { model_id } = data;

    const fal: FalClient = createFalClient({
        credentials: customApiKey || "unkonwkey", // or a function that returns a string
        // suppressLocalCredentialsWarning: true,
    });

    // model support check
    const setting = findSettingByModelId(model_id);

    if (!setting?.apiInput || !setting?.apiInput?.endpoint) {
        return { success: false, data: null, error: "Unsupported model, no endpoint" }
    }

    const api_endpoint = setting?.apiInput?.endpoint;
    console.log('api_endpoint', api_endpoint)
    // build api input
    const input = buildApiInput(setting.apiInput, data)

    const submit_setting: any = { input };

    if (webhook_url) {
        submit_setting.webhookUrl = `${webhook_url}?model_id=${model_id}`;
    }

    try {
        const { request_id } = await fal.queue.submit(api_endpoint, submit_setting);
        // console.debug(request_id);
        return { success: true, data: request_id, error: null }
    } catch (error: any) {
        console.error("handleGeneration error:", error);
        if (error instanceof ApiError) {
            console.error("ApiError error body:", error?.body);
            console.error("ApiError status:", error?.status);
            return { success: false, data: null, error: `api error: ${error?.status} ${error?.body?.detail}` }
        }
        else {
            return { success: false, data: null, error: error?.message || "Unexpected api error occurred, please check your api key" }
        }

    }
}

export const handleFalGeneration = async (data: any, webhook_url = '', customApiKey: string = '') => {
    // let fal_enpoint = 'fal-ai/flux/schnell'

    const { model_id } = data;

    const fal: FalClient = createFalClient({
        credentials: customApiKey || "unkonwkey", // or a function that returns a string
        // suppressLocalCredentialsWarning: true,
    });

    // model support check
    const setting = findSettingByModelId(model_id);

    if (!setting?.apiInput || !setting?.apiInput?.endpoint) {
        return { success: false, data: null, error: "Unsupported model, no endpoint" }
    }

    const api_endpoint = setting?.apiInput?.endpoint;
    console.log('api_endpoint', api_endpoint)
    // build api input
    const input = buildApiInput(setting.apiInput, data)

    const submit_setting: any = { input };

    if (webhook_url) {
        submit_setting.webhookUrl = `${webhook_url}?model_id=${model_id}`;
    }
    // const err_input_test = {
    //     ...input,
    //     enable_safety_checker: true
    // }
    try {
        const result = await fal.subscribe(api_endpoint, {
            input,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs.map((log) => log.message).forEach(console.log);
                }
            },
            pollInterval: 1000,

        });
        if (result?.data) {

            return { success: true, data: result?.data, error: null }
        } else {
            console.error("handleGeneration error result:", result);
            return { success: false, data: null, error: "Unexpected api error occurred, please check your api key" }
        }
    } catch (error: any) {

        console.error("handleGeneration error:", error);
        if (error instanceof ApiError) {
            console.error("ApiError error body:", error?.body);
            console.error("ApiError status:", error?.status);
            return { success: false, data: null, error: `api error: ${error?.status} ${error?.body?.detail}` }
        }
        else {
            return { success: false, data: null, error: error?.message || "Unexpected api error occurred, please check your api key" }
        }
    }
}

// =============================================================================
// bltcy Nano-banana (OpenAI-compatible image generation)
// =============================================================================
export async function handleBltcyGeneration(
    data: any,
    customApiKey: string,
    baseUrl: string = 'https://api.bltcy.ai'
) {
    const { model_id } = data;
    const setting = findSettingByModelId(model_id);

    if (!setting?.apiInput?.endpoint) {
        return { success: false, data: null, error: "Unsupported model" };
    }

    const endpoint = setting.apiInput.endpoint;
    const input = buildApiInput(setting.apiInput, data);

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${customApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(input)
        });

        const result = await response.json();

        if (!response.ok) {
            return { success: false, data: null, error: result.error?.message || 'API error' };
        }

        // Extract image URL from OpenAI-compatible response
        let imageUrl = null;
        if (result.data && result.data[0]?.url) {
            imageUrl = result.data[0].url;
        } else if (result.data && result.data[0]?.b64_json) {
            imageUrl = `data:image/png;base64,${result.data[0].b64_json}`;
        }

        if (imageUrl) {
            return { success: true, data: { images: [{ url: imageUrl }] }, error: null };
        }

        return { success: false, data: null, error: 'No image in response' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message };
    }
}
