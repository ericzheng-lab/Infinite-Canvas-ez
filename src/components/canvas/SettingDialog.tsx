'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUserSettingStore } from '@/hooks/stores/user-setting';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/shadcn-ui/dialog';
import { Label, Input, Button, Checkbox } from '@/components/ui';
import { Check, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface SettingDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const SettingDialog: React.FC<SettingDialogProps> = ({ isOpen, onOpenChange }) => {

  const setSetting = useUserSettingStore((s) => s.setSetting);
  const removeSetting = useUserSettingStore((s) => s.removeSetting);

  // initial from store (string fallback)
  const initialKey = useMemo(
    () => useUserSettingStore.getState().getSetting('falApiKey') as string ?? '',
    []
  );
  const [apiKey, setApiKey] = useState<string>(initialKey);

  // new: control whether to save permanently
  const [isPersistent, setIsPersistent] = useState<boolean>(false);

  // Midjourney settings
  const [mjBaseUrl, setMjBaseUrl] = useState<string>('https://api.midjourney.com');
  const [mjApiKey, setMjApiKey] = useState<string>('');

  // Seedream settings
  const [seedBaseUrl, setSeedBaseUrl] = useState<string>('https://api.seedream.vip');
  const [seedApiKey, setSeedApiKey] = useState<string>('');

  // bltcy settings
  const [bltcyApiKey, setBltcyApiKey] = useState<string>('');

  // when open dialog, sync latest store value
  useEffect(() => {
    if (isOpen) {
      const latest = useUserSettingStore.getState().getSetting('falApiKey') as string ?? '';
      setApiKey(latest);
      const hasPersistentKey = useUserSettingStore.getState().hasSetting('falApiKey');
      setIsPersistent(hasPersistentKey);
    }
  }, [isOpen]);

  // save setting function
  const saveApiKey = () => {
    if (isPersistent) {
      setSetting('falApiKey', apiKey, {
        persistent: true,
        category: 'auth',
        description: 'FAL API key (permanent)'
      });
      toast.success('FAL API key saved permanently');
    } else {
      setSetting('falApiKey', apiKey, {
        category: 'auth',
        description: 'FAL API key (temporary)'
      });
      toast.success('FAL API key saved temporarily');
    }
  };

  const removeApiKey = () => {
    removeSetting('falApiKey');
    setApiKey('');
    toast.success('FAL API key removed');
  };

  const saveMjKey = () => {
    setSetting('mjApiKey', mjApiKey, { persistent: true, category: 'auth' });
    setSetting('mjBaseUrl', mjBaseUrl, { persistent: true, category: 'auth' });
    toast.success('Midjourney settings saved');
  };

  const saveSeedKey = () => {
    setSetting('seedApiKey', seedApiKey, { persistent: true, category: 'auth' });
    setSetting('seedBaseUrl', seedBaseUrl, { persistent: true, category: 'auth' });
    toast.success('Seedream settings saved');
  };

  const saveBltcyKey = () => {
    setSetting('bltcyApiKey', bltcyApiKey, { persistent: true, category: 'auth' });
    toast.success('bltcy API key saved');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4 cursor-pointer" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[90vw] md:max-w-[75vw] max-h-[85vh] overflow-y-auto">
        <DialogTitle>Settings</DialogTitle>

        <div className="space-y-6">

          {/* ── FAL API ── */}
          <div className="space-y-3 p-4 border rounded-xl">
            <h3 className="font-semibold text-sm">FAL API (Built-in Image Models)</h3>
            <div className="space-y-2">
              <Label htmlFor="fal-api-key">API Key</Label>
              <Input id="fal-api-key" type="password" placeholder="fal-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono" style={{ fontSize: '16px' }} />
              <p className="text-xs text-muted-foreground">Get from <a href="https://fal.ai/dashboard/keys" target="_blank" className="underline">fal.ai/dashboard/keys</a></p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="fal-persist" checked={isPersistent} onCheckedChange={(c) => setIsPersistent(c === true)} />
              <Label htmlFor="fal-persist" className="text-sm">Save permanently</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveApiKey} disabled={!apiKey} className="flex-1">{isPersistent ? 'Save' : 'Save Temporarily'}</Button>
              <Button onClick={removeApiKey} disabled={!apiKey} variant="outline">Remove</Button>
            </div>
          </div>

          {/* ── Midjourney API ── */}
          <div className="space-y-3 p-4 border rounded-xl">
            <h3 className="font-semibold text-sm">Midjourney API</h3>
            <div className="space-y-2">
              <Label htmlFor="mj-base-url">Base URL</Label>
              <Input id="mj-base-url" value={mjBaseUrl} onChange={(e) => setMjBaseUrl(e.target.value)} className="font-mono text-sm" placeholder="https://your-mj-proxy.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mj-api-key">API Key</Label>
              <Input id="mj-api-key" type="password" value={mjApiKey} onChange={(e) => setMjApiKey(e.target.value)} className="font-mono" style={{ fontSize: '16px' }} placeholder="sk-..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveMjKey} disabled={!mjApiKey || !mjBaseUrl} className="flex-1">Save Midjourney</Button>
            </div>
          </div>

          {/* ── Seedream API ── */}
          <div className="space-y-3 p-4 border rounded-xl">
            <h3 className="font-semibold text-sm">Seedream API</h3>
            <div className="space-y-2">
              <Label htmlFor="seed-base-url">Base URL</Label>
              <Input id="seed-base-url" value={seedBaseUrl} onChange={(e) => setSeedBaseUrl(e.target.value)} className="font-mono text-sm" placeholder="https://api.seedream.vip" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seed-api-key">API Key</Label>
              <Input id="seed-api-key" type="password" value={seedApiKey} onChange={(e) => setSeedApiKey(e.target.value)} className="font-mono" style={{ fontSize: '16px' }} placeholder="Bearer ..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSeedKey} disabled={!seedApiKey || !seedBaseUrl} className="flex-1">Save Seedream</Button>
            </div>
          </div>

          {/* ── bltcy Nano-banana API ── */}
          <div className="space-y-3 p-4 border rounded-xl">
            <h3 className="font-semibold text-sm">bltcy.ai (Nano-banana / Gemini Image)</h3>
            <div className="space-y-2">
              <Label htmlFor="bltcy-api-key">API Key</Label>
              <Input id="bltcy-api-key" type="password" value={bltcyApiKey} onChange={(e) => setBltcyApiKey(e.target.value)} className="font-mono" style={{ fontSize: '16px' }} placeholder="sk-..." />
            </div>
            <p className="text-xs text-muted-foreground">Base URL: https://api.bltcy.ai (fixed)</p>
            <div className="flex gap-2">
              <Button onClick={saveBltcyKey} disabled={!bltcyApiKey} className="flex-1">Save bltcy</Button>
            </div>
          </div>

          {!!apiKey && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>{isPersistent ? 'FAL API key saved permanently' : 'Using temporary FAL API key'}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
