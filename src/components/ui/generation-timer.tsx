import { useEffect, useState } from 'react'
import { motion, useSpring } from 'framer-motion'

interface GenerationTimerProps {
    isRunning: boolean
    estimatedTime: number | null  // in ms
}

export function GenerationTimer({ isRunning, estimatedTime }: GenerationTimerProps) {
    const [elapsedMs, setElapsedMs] = useState(0)

    useEffect(() => {
        if (!isRunning) {
            setElapsedMs(0)
            return
        }

        const startTime = Date.now()
        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startTime)
        }, 100)

        return () => clearInterval(interval)
    }, [isRunning])

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        const tenths = Math.floor((ms % 1000) / 100)

        if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
        }
        return `${seconds}.${tenths}s`
    }

    const estimatedSeconds = estimatedTime ? Math.round(estimatedTime / 1000) : null

    // Animation for the counter
    const springValue = useSpring(elapsedMs / 1000, {
        stiffness: 100,
        damping: 30,
    })

    useEffect(() => {
        springValue.set(elapsedMs / 1000)
    }, [elapsedMs, springValue])

    if (!isRunning) return null

    return (
        <div className="flex flex-col items-center gap-1">
            <motion.div
                className="text-2xl font-mono font-bold text-primary tabular-nums"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
            >
                {formatTime(elapsedMs)}
            </motion.div>
            {estimatedSeconds && (
                <motion.p
                    className="text-sm text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    예상: ~{estimatedSeconds}초
                </motion.p>
            )}
        </div>
    )
}
