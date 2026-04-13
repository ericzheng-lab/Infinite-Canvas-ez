"use client";

import { buildApiInput } from '@/utils/tools/mapping';
import { findSettingByModelId } from "@/lib/ai-model-setting/modelSetting";

const POLL_INTERVAL = 3000;
const MAX_POLL_COUNT = 60;

export interface SeedreamTaskResult {
    id: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    imageUrl?: string;
    failReason?: string;
}

export interface SeedreamGenerationResult {
    success: boolean;
    data: SeedreamTaskResult | null;
    error: string | null;
}

// Submit Seedream task
export async function submitSeedreamTask(
    baseUrl: string,
    apiKey: string,
    model_id: string,
    data: any
): Promise<{ success: boolean; data: string | null; error: string | null }> {
    const setting = findSettingByModelId(model_id);
    if (!setting?.apiInput?.endpoint) {
        return { success: false, data: null, error: "Unsupported model" };
    }

    const endpoint = setting.apiInput.endpoint;
    const input = buildApiInput(setting.apiInput, data);

    try {
        // Use multipart/form-data for Seedream
        const formData = new FormData();
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        }

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.code === 0 && result.data?.task_id) {
            return { success: true, data: result.data.task_id, error: null };
        }

        // If sync response (has image_url directly), return immediately
        if (result.code === 0 && result.data?.image_url) {
            return {
                success: true,
                data: '__sync__',
                error: null
            };
        }

        return { success: false, data: null, error: result.message || 'Submit failed' };
    } catch (error: any) {
        return { success: false, data: null, error: error.message };
    }
}

// Poll Seedream task
export async function pollSeedreamTask(
    baseUrl: string,
    apiKey: string,
    taskId: string
): Promise<SeedreamGenerationResult> {
    for (let i = 0; i < MAX_POLL_COUNT; i++) {
        try {
            const response = await fetch(`${baseUrl}/v1/task/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, data: null, error: result.message || 'Poll failed' };
            }

            if (result.code === 0) {
                const status = result.data?.status;

                if (status === 'success') {
                    return {
                        success: true,
                        data: {
                            id: taskId,
                            status: 'success',
                            imageUrl: result.data.image_url
                        },
                        error: null
                    };
                }

                if (status === 'failed') {
                    return { success: false, data: null, error: result.data?.fail_reason || 'Task failed' };
                }

                // Still processing
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            }
        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        }
    }

    return { success: false, data: null, error: 'Timeout: max poll count reached' };
}

// Main handler
export async function handleSeedreamGeneration(
    baseUrl: string,
    apiKey: string,
    model_id: string,
    data: any,
    onProgress?: (progress: string) => void
): Promise<{ success: boolean; data: any; error: string | null }> {
    // Step 1: Submit
    const submitResult = await submitSeedreamTask(baseUrl, apiKey, model_id, data);

    if (!submitResult.success || !submitResult.data) {
        return { success: false, data: null, error: submitResult.error };
    }

    // If sync response (text2img returns image directly)
    if (submitResult.data === '__sync__') {
        return { success: true, data: submitResult.data, error: null };
    }

    const taskId = submitResult.data;
    console.log('Seedream task submitted:', taskId);

    // Step 2: Poll
    const pollResult = await pollSeedreamTask(baseUrl, apiKey, taskId);

    if (pollResult.success && pollResult.data) {
        return {
            success: true,
            data: pollResult.data.imageUrl,
            error: null
        };
    }

    return { success: false, data: null, error: pollResult.error };
}

// Check if model is Seedream type
export function isSeedreamModel(model_id: string): boolean {
    return model_id.startsWith('seedream-');
}