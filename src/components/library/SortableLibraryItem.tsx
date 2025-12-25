import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LibraryItem as LibraryItemType } from '@/stores/library-store'
import { LibraryItem } from './LibraryItem'

interface SortableLibraryItemProps {
    item: LibraryItemType
    onRename: (item: LibraryItemType) => void
    onAddRef: (item: LibraryItemType) => void
    onLoadMetadata: (item: LibraryItemType) => void
    onImageClick?: (imageUrl: string) => void
}

export function SortableLibraryItem({ item, onRename, onAddRef, onLoadMetadata, onImageClick }: SortableLibraryItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.0 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} id={item.id} className="w-full h-full">
            <LibraryItem item={item} onRename={onRename} onAddRef={onAddRef} onLoadMetadata={onLoadMetadata} onImageClick={onImageClick} />
        </div>
    )
}
