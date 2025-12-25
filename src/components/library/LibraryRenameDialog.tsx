
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface LibraryRenameDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialName: string
    onConfirm: (newName: string) => void
}

export function LibraryRenameDialog({
    open,
    onOpenChange,
    initialName,
    onConfirm,
}: LibraryRenameDialogProps) {
    const { t } = useTranslation()
    const [name, setName] = useState(initialName)

    useEffect(() => {
        setName(initialName)
    }, [initialName, open])

    const handleConfirm = () => {
        if (name.trim()) {
            onConfirm(name.trim())
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('actions.rename', 'Rename')}</DialogTitle>
                    <DialogDescription>
                        {t('library.renameDesc', 'Enter a new name for this item.')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirm()
                        }}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleConfirm}>{t('common.confirm', 'Confirm')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
