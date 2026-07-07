import { useEffect, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Download, ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { exportAllData } from '@/lib/indexed-db'

const DISMISS_KEY = 'nais3-migration-dismissed'
const NAIS3_RELEASES = 'https://github.com/sunanakgo/NAIS3/releases'

/**
 * NAIS3 출시 안내 다이얼로그 — 시작 시 1회 표시 (다시 보지 않기 가능).
 * 백업 내보내기 → NAIS3에서 불러오기로 데이터가 그대로 이전된다.
 */
export function Nais3MigrationDialog() {
    const [open, setOpen] = useState(false)
    const [dontShowAgain, setDontShowAgain] = useState(false)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        if (localStorage.getItem(DISMISS_KEY) !== '1') {
            // 첫 화면이 뜬 뒤 살짝 늦게 (시작 로딩과 겹치지 않게)
            const timer = setTimeout(() => setOpen(true), 1200)
            return () => clearTimeout(timer)
        }
    }, [])

    const close = () => {
        if (dontShowAgain) localStorage.setItem(DISMISS_KEY, '1')
        setOpen(false)
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const backup = await exportAllData()
            const filePath = await save({
                title: '백업 내보내기',
                defaultPath: `nais2-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (filePath) {
                await writeTextFile(filePath, JSON.stringify(backup, null, 2))
                localStorage.setItem('nais2-last-backup-time', new Date().toISOString())
                toast({
                    title: '백업 내보내기 완료',
                    description: 'NAIS3의 설정 → 저장 → 데이터 백업 → 불러오기에서 이 파일을 선택하세요.',
                    variant: 'success',
                })
            }
        } catch (err) {
            console.error('Backup export failed:', err)
            toast({ title: '백업 내보내기 실패', description: String(err), variant: 'destructive' })
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && close()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                        NAIS3가 나왔습니다
                    </DialogTitle>
                    <DialogDescription className="pt-2 text-left leading-relaxed">
                        NAIS2의 후속작을 새로 만들었어요. NAIS2는 계속 쓸 수 있지만,
                        앞으로의 기능 추가는 NAIS3에서 이어집니다.
                    </DialogDescription>
                </DialogHeader>

                <ul className="space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    <li>· NAI 웹과 동일한 시드 — 같은 시드 = 같은 그림</li>
                    <li>· 씬 모드·디렉터 툴(배경제거/업스케일 등) 개선</li>
                    <li>· 더 가볍고 안정적 — 대량 생성에도 안 죽음</li>
                    <li>· 백업 파일로 캐릭터·프리셋·조각 그대로 이전</li>
                </ul>

                <div className="flex gap-2">
                    <Button className="flex-1 gap-1.5" variant="outline" onClick={handleExport} disabled={exporting}>
                        <Download className="h-4 w-4" />
                        {exporting ? '내보내는 중…' : '백업 내보내기'}
                    </Button>
                    <Button className="flex-1 gap-1.5" onClick={() => openUrl(NAIS3_RELEASES)}>
                        <ExternalLink className="h-4 w-4" />
                        NAIS3 받기
                    </Button>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                            checked={dontShowAgain}
                            onCheckedChange={(v) => setDontShowAgain(v === true)}
                        />
                        다시 보지 않기
                    </label>
                    <Button variant="ghost" onClick={close}>
                        나중에
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
