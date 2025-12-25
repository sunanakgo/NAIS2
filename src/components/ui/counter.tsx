import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

import './counter.css'

interface CounterProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    fontSize?: number
    className?: string
}

function Number({ mv, number, height }: { mv: ReturnType<typeof useSpring>; number: number; height: number }) {
    const y = useTransform(mv, (latest: number) => {
        const placeValue = latest % 10
        const offset = (10 + number - placeValue) % 10
        let memo = offset * height
        if (offset > 5) {
            memo -= 10 * height
        }
        return memo
    })
    return (
        <motion.span className="counter-number" style={{ y }}>
            {number}
        </motion.span>
    )
}

function Digit({ place, value, height }: { place: number; value: number; height: number }) {
    const valueRoundedToPlace = Math.floor(value / place)
    const animatedValue = useSpring(valueRoundedToPlace, { stiffness: 300, damping: 30 })

    useEffect(() => {
        animatedValue.set(valueRoundedToPlace)
    }, [animatedValue, valueRoundedToPlace])

    return (
        <div className="counter-digit" style={{ height }}>
            {Array.from({ length: 10 }, (_, i) => (
                <Number key={i} mv={animatedValue} number={i} height={height} />
            ))}
        </div>
    )
}

export default function Counter({
    value,
    onChange,
    min = 1,
    max = 99,
    fontSize = 20,
    className = '',
}: CounterProps) {
    const height = fontSize + 4

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1)
        }
    }

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1)
        }
    }

    const places = value >= 10 ? [10, 1] : [1]

    return (
        <div className={`counter-container ${className}`}>
            <button
                type="button"
                onClick={handleDecrement}
                disabled={value <= min}
                className="counter-button"
            >
                <Minus className="w-3 h-3" />
            </button>
            <div className="counter-display" style={{ fontSize, height }}>
                {places.map((place) => (
                    <Digit key={place} place={place} value={value} height={height} />
                ))}
            </div>
            <button
                type="button"
                onClick={handleIncrement}
                disabled={value >= max}
                className="counter-button"
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    )
}
