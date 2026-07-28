import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDragResizeOptions {
  /** 拖拽轴方向：'x' 水平（侧边栏）、'y' 垂直（底部面板） */
  axis: 'x' | 'y';
  /** 最小尺寸（px） */
  minSize: number;
  /** 最大尺寸（px） */
  maxSize: number;
  /** 初始尺寸 */
  defaultSize: number;
  /** 尺寸变更回调（RAF 去抖后调用） */
  onSizeChange: (size: number) => void;
}

interface UseDragResizeReturn {
  /** 当前尺寸 */
  size: number;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 拖拽手柄的 onMouseDown 处理器 */
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 通用拖拽调整大小 hook。
 * 消除 SidePanel 和 EditorArea 中重复的拖拽逻辑。
 */
export function useDragResize({
  axis,
  minSize,
  maxSize,
  defaultSize,
  onSizeChange,
}: UseDragResizeOptions): UseDragResizeReturn {
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);

  const draggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const dragSizeRef = useRef(0);

  const cursor = axis === 'x' ? 'col-resize' : 'row-resize';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      setIsDragging(true);
      startPosRef.current = axis === 'x' ? e.clientX : e.clientY;
      startSizeRef.current = size;
      dragSizeRef.current = size;
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
    },
    [cursor, axis, size],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = axis === 'x' ? e.clientX - startPosRef.current : startPosRef.current - e.clientY;
      const newSize = Math.max(minSize, Math.min(maxSize, startSizeRef.current + delta));
      dragSizeRef.current = newSize;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setSize(dragSizeRef.current);
          onSizeChange(dragSizeRef.current);
        });
      }
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setSize(dragSizeRef.current);
      onSizeChange(dragSizeRef.current);
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [minSize, maxSize, onSizeChange, axis]);

  return { size, isDragging, handleMouseDown };
}
