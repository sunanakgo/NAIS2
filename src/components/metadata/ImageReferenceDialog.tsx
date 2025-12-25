import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Sparkles, User } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCharacterStore } from '@/stores/character-store'
import { toast } from '@/components/ui/use-toast'

interface ImageReferenceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    imageBase64: string | null
}

export function ImageReferenceDialog({ open, onOpenChange, imageBase64 }: ImageReferenceDialogProps) {
    const { t } = useTranslation()
    const { addVibeImage, addCharacterImage } = useCharacterStore()
    const [isProcessing, setIsProcessing] = useState(false)

    const handleAddAsVibe = async () => {
        if (!imageBase64) return
        setIsProcessing(true)
        try {
            addVibeImage(imageBase64)
            toast({
                title: t('imageRef.addedVibe', 'Vibe Transfer에 추가됨'),
                variant: 'success',
            })
            onOpenChange(false)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAddAsCharacter = async () => {
        if (!imageBase64) return
        setIsProcessing(true)
        try {
            addCharacterImage(imageBase64)
            toast({
                title: t('imageRef.addedChar', '캐릭터 레퍼런스에 추가됨'),
                variant: 'success',
            })
            onOpenChange(false)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ImagePlus className="h-5 w-5" />
                        {t('imageRef.title', '이미지 참조 추가')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('imageRef.description', '이 이미지를 어디에 추가할까요?')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 mt-4">
                    {/* Left: Image Preview */}
                    {imageBase64 && (
                        <div className="flex-shrink-0">
                            <img
                                src={imageBase64}
                                alt="Preview"
                                className="w-32 h-32 rounded-lg border object-cover"
                            />
                        </div>
                    )}

                    {/* Right: Buttons stacked vertically */}
                    <div className="flex-1 flex flex-col gap-3">
                        {/* Character Reference Button - Top */}
                        <Button
                            variant="outline"
                            className="flex-1 flex items-center gap-3 hover:bg-primary/10 hover:border-primary"
                            onClick={handleAddAsCharacter}
                            disabled={isProcessing}
                        >
                            <User className="h-6 w-6 text-blue-500 flex-shrink-0" />
                            <div className="text-left">
                                <div className="font-medium">
                                    {t('imageRef.charRef', '캐릭터 레퍼런스')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t('imageRef.charDesc', '캐릭터 일관성 유지')}
                                </div>
                            </div>
                        </Button>

                        {/* Vibe Transfer Button - Bottom */}
                        <Button
                            variant="outline"
                            className="flex-1 flex items-center gap-3 hover:bg-primary/10 hover:border-primary"
                            onClick={handleAddAsVibe}
                            disabled={isProcessing}
                        >
                            <Sparkles className="h-6 w-6 text-purple-500 flex-shrink-0" />
                            <div className="text-left">
                                <div className="font-medium">
                                    {t('imageRef.vibeTransfer', 'Vibe Transfer')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t('imageRef.vibeDesc', '이미지 스타일/분위기 참조')}
                                </div>
                            </div>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
