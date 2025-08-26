import { useEffect, useRef, useCallback } from 'react';

interface UseAutoScrollOptions {
  enabled?: boolean;
  smooth?: boolean;
  threshold?: number;
}

export const useAutoScroll = <T extends HTMLElement>(
  dependencies: any[],
  options: UseAutoScrollOptions = {}
) => {
  const {
    enabled = true,
    smooth = true,
    threshold = 100,
  } = options;

  const elementRef = useRef<T>(null);
  const isNearBottom = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (elementRef.current) {
      elementRef.current.scrollTo({
        top: elementRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const checkIfNearBottom = useCallback(() => {
    if (!elementRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = elementRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    return distanceFromBottom <= threshold;
  }, [threshold]);

  const handleScroll = useCallback(() => {
    isNearBottom.current = checkIfNearBottom();
  }, [checkIfNearBottom]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!enabled) return;

    // 사용자가 스크롤을 위로 올렸다면 자동 스크롤하지 않음
    if (!isNearBottom.current) return;

    // 즉시 스크롤 (애니메이션 없이)
    scrollToBottom('auto');
  }, dependencies);

  // 컴포넌트 마운트 시 스크롤
  useEffect(() => {
    if (enabled) {
      scrollToBottom('auto');
    }
  }, []);

  return {
    elementRef,
    scrollToBottom,
    isNearBottom: isNearBottom.current,
  };
};
