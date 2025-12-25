import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

export const RESOLUTION_PRESETS = [
    { key: 'portrait', width: 832, height: 1216 },
    { key: 'landscape', width: 1216, height: 832 },
    { key: 'square', width: 1024, height: 1024 },
    { key: 'tallPortrait', width: 640, height: 1536 },
    { key: 'wideLandscape', width: 1536, height: 640 },
]

export interface Resolution {
    label: string
    width: number
    height: number
}

interface ResolutionSelectorProps {
    value: Resolution
    onChange: (resolution: Resolution) => void
    disabled?: boolean
}

export function ResolutionSelector({ value, onChange, disabled }: ResolutionSelectorProps) {
    const { t } = useTranslation()
    const [customWidth, setCustomWidth] = useState(1024)
    const [customHeight, setCustomHeight] = useState(1024)
    const [customDialogOpen, setCustomDialogOpen] = useState(false)
    const [customLabel, setCustomLabel] = useState('Custom')

    // Find if current value matches a preset
    const currentPreset = RESOLUTION_PRESETS.find(
        (p) => p.width === value.width && p.height === value.height
    )

    // If not a standard preset, treat as custom
    const selectedValue = currentPreset ? currentPreset.key : 'custom_value'

    const handleValueChange = (val: string) => {
        if (val === 'custom') {
            setCustomDialogOpen(true)
            return
        }

        const preset = RESOLUTION_PRESETS.find((p) => p.key === val)
        if (preset) {
            onChange({
                label: t(`resolutions.${preset.key}`),
                width: preset.width,
                height: preset.height,
            })
        }
    }

    const handleCustomSave = () => {
        onChange({
            label: customLabel || `${customWidth}x${customHeight}`,
            width: Number(customWidth),
            height: Number(customHeight),
        })
        setCustomDialogOpen(false)
    }

    return (
        <>
            <Select
                value={selectedValue}
                onValueChange={handleValueChange}
                disabled={disabled}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('resolutions.portrait')} >
                        {selectedValue === 'custom_value' ? `${value.width} × ${value.height}` : undefined}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {RESOLUTION_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                            <span className="flex items-center justify-between w-full min-w-[180px]">
                                <span>{t(`resolutions.${p.key}`)}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {p.width} × {p.height}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-primary font-medium">
                        <span className="flex items-center">
                            <Plus className="mr-2 h-4 w-4" />
                            {t('resolutions.addCustom')}
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>

            <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('resolutions.addCustom')}</DialogTitle>
                        <DialogDescription>
                            {t('resolutions.addCustomDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                {t('resolutions.presetName')}
                            </Label>
                            <Input
                                id="name"
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="width" className="text-right">
                                {t('resolutions.width')}
                            </Label>
                            <Input
                                id="width"
                                type="number"
                                value={customWidth}
                                onChange={(e) => setCustomWidth(Number(e.target.value))}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="height" className="text-right">
                                {t('resolutions.height')}
                            </Label>
                            <Input
                                id="height"
                                type="number"
                                value={customHeight}
                                onChange={(e) => setCustomHeight(Number(e.target.value))}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={handleCustomSave}>
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
